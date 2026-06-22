/**
 * R2 Migration Script
 *
 * Uploads existing local files from public/uploads/ to Cloudflare R2,
 * then updates the database to point file URLs to the CDN domain.
 *
 * Prerequisites:
 *   1. Set R2_* environment variables in .env
 *   2. R2 bucket, API token, and CDN domain must be created
 *
 * Usage:
 *   npm run migrate-to-r2           → run migration
 *   npm run migrate-to-r2 -- --dry  → preview changes without writing
 *
 * Environment variables required:
 *   R2_ACCESS_KEY_ID       R2 API token access key
 *   R2_SECRET_ACCESS_KEY   R2 API token secret
 *   R2_ENDPOINT            https://<account-id>.r2.cloudflarestorage.com
 *   R2_BUCKET              Bucket name (e.g., b2bcms-media)
 *   R2_CDN_URL             CDN custom domain (e.g., https://cdn.productsb2b.com)
 */

const path = require('path');
const fs = require('fs');

// ── CLI args ──────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry');

// ── Helpers ───────────────────────────────────────────────────────

/** Resolve public/uploads/ absolute path relative to project root. */
function getUploadsDir() {
  // scripts/migrate-to-r2.js → project root is one level up
  return path.resolve(__dirname, '..', 'public', 'uploads');
}

/** Convert a local file path to an R2 key (preserving relative path structure). */
function toR2Key(filePath, uploadsDir) {
  const relative = path.relative(uploadsDir, filePath);
  // Normalize Windows backslashes to forward slashes for S3 keys
  return 'uploads/' + relative.split(path.sep).join('/');
}

/** Build the CDN URL for a given R2 key. */
function toCdnUrl(r2Key, cdnUrl) {
  const base = cdnUrl.replace(/\/+$/, '');
  return `${base}/${r2Key}`;
}

/**
 * Walk a directory recursively, returning absolute paths of all files.
 * Skips .gitkeep and similar non-upload artifacts.
 */
function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && !entry.name.startsWith('.')) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Pretty-print bytes. */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  let s3;
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3 = S3Client;
  } catch {
    console.error('[R2 Migration] ERROR: @aws-sdk/client-s3 is not installed.');
    console.error('  Run: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage');
    process.exit(1);
  }

  console.log('[R2 Migration] Starting R2 file migration...');
  if (DRY_RUN) console.log('[R2 Migration] *** DRY RUN MODE — no writes will be performed ***\n');

  // ── 0. Validate environment ──────────────────────────────────
  const requiredVars = [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_ENDPOINT',
    'R2_BUCKET',
    'R2_CDN_URL',
  ];
  const missing = requiredVars.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[R2 Migration] ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('  Set them in .env or export them before running this script.');
    process.exit(1);
  }

  const R2 = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT,
    bucket: process.env.R2_BUCKET,
    region: process.env.R2_REGION || 'auto',
    cdnUrl: process.env.R2_CDN_URL,
  };

  console.log(`[R2 Migration] R2 endpoint: ${R2.endpoint}`);
  console.log(`[R2 Migration] R2 bucket:   ${R2.bucket}`);
  console.log(`[R2 Migration] CDN URL:     ${R2.cdnUrl}`);

  // ── 1. Bootstrap Strapi for DB access ────────────────────────
  console.log('\n[R2 Migration] Booting Strapi...');
  const strapiFactory = require('@strapi/strapi');
  const app = await strapiFactory().load();
  await app.bootstrap();
  console.log('[R2 Migration] Strapi booted.');

  // ── 2. Scan local files ──────────────────────────────────────
  const uploadsDir = getUploadsDir();
  console.log(`\n[R2 Migration] Scanning: ${uploadsDir}`);
  const localFiles = walkDir(uploadsDir);
  console.log(`[R2 Migration] Found ${localFiles.length} local files`);

  if (localFiles.length === 0) {
    console.log('[R2 Migration] Nothing to migrate. Exiting.');
    await app.destroy();
    process.exit(0);
  }

  // ── 3. Match local files to DB records ───────────────────────
  // Query all file records where provider is still local.
  const dbFiles = await strapi.db.query('plugin::upload.file').findMany({
    where: { provider: 'local' },
  });
  console.log(`[R2 Migration] Found ${dbFiles.length} DB records with provider=local`);

  // Build a lookup: local relative path → DB record
  // Strapi stores url as "/uploads/filename.png" — normalize to forward-slash path
  const dbByUrl = new Map();
  for (const f of dbFiles) {
    const url = (f.url || '').replace(/\\/g, '/');
    dbByUrl.set(url, f);
  }

  // Match each local file to a DB record
  const matched = []; // { localPath, r2Key, dbRecord }
  const unmatchedLocal = [];
  const unmatchedDb = new Set(dbFiles.map((f) => f.url));

  for (const filePath of localFiles) {
    const r2Key = toR2Key(filePath, uploadsDir);
    const relativeUrl = '/' + r2Key; // e.g., /uploads/filename.png
    const dbRecord = dbByUrl.get(relativeUrl);

    if (dbRecord) {
      matched.push({ localPath: filePath, r2Key, dbRecord });
      unmatchedDb.delete(dbRecord.url);
    } else {
      // Maybe the file is a thumbnail variant (e.g., /uploads/thumbnail_filename.png)
      // Strapi stores these in the `formats` JSON, not as separate rows
      unmatchedLocal.push({ localPath: filePath, r2Key });
    }
  }

  console.log(`[R2 Migration] Matched:       ${matched.length} files to DB records`);
  console.log(`[R2 Migration] Unmatched local: ${unmatchedLocal.length} (likely thumbnail variants — will upload anyway)`);
  console.log(`[R2 Migration] Unmatched DB:   ${unmatchedDb.size} (DB records with no local file)`);

  // ── 4. Create S3 client ──────────────────────────────────────
  const s3Client = new s3({
    region: R2.region,
    endpoint: R2.endpoint,
    credentials: {
      accessKeyId: R2.accessKeyId,
      secretAccessKey: R2.secretAccessKey,
    },
    forcePathStyle: false, // R2 supports virtual-hosted style
  });

  // ── 5. Upload all local files to R2 ─────────────────────────
  console.log('\n[R2 Migration] ── Uploading files to R2 ──');
  let uploadedCount = 0;
  let uploadedBytes = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const allFilesToUpload = [
    ...matched.map((m) => ({ localPath: m.localPath, r2Key: m.r2Key })),
    ...unmatchedLocal.map((u) => ({ localPath: u.localPath, r2Key: u.r2Key })),
  ];

  // S3 putObject helper
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  for (let i = 0; i < allFilesToUpload.length; i++) {
    const { localPath: filePath, r2Key } = allFilesToUpload[i];
    const fileBytes = fs.readFileSync(filePath);
    const fileSize = fileBytes.length;
    const mimeType = guessMime(filePath);

    if (DRY_RUN) {
      console.log(`  [DRY] Would upload: ${r2Key} (${formatBytes(fileSize)})`);
      uploadedCount++;
      uploadedBytes += fileSize;
      continue;
    }

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: R2.bucket,
          Key: r2Key,
          Body: fileBytes,
          ContentType: mimeType,
        }),
      );
      uploadedCount++;
      uploadedBytes += fileSize;

      if ((i + 1) % 20 === 0 || i === allFilesToUpload.length - 1) {
        console.log(`  Uploaded ${i + 1}/${allFilesToUpload.length} files (${formatBytes(uploadedBytes)})`);
      }
    } catch (err) {
      errorCount++;
      console.error(`  ERROR uploading ${r2Key}: ${err.message}`);
      if (errorCount > 5) {
        console.error('[R2 Migration] Too many errors — aborting upload phase.');
        break;
      }
    }
  }

  console.log(`\n[R2 Migration] Upload phase complete: ${uploadedCount} uploaded, ${skippedCount} skipped, ${errorCount} errors (${formatBytes(uploadedBytes)} total)`);

  if (DRY_RUN) {
    console.log('\n[R2 Migration] DRY RUN — skipping DB updates.');
  } else if (errorCount === 0 || uploadedCount > 0) {
    // ── 6. Update database URLs ────────────────────────────────
    console.log('\n[R2 Migration] ── Updating database URLs ──');

    let dbUpdated = 0;
    let dbErrors = 0;

    for (const { r2Key, dbRecord } of matched) {
      const cdnUrl = toCdnUrl(r2Key, R2.cdnUrl);
      const oldUrl = dbRecord.url;

      try {
        // Build updated formats JSON (replace relative URLs with CDN URLs)
        let formats = null;
        if (dbRecord.formats && typeof dbRecord.formats === 'object') {
          formats = {};
          for (const [formatName, formatData] of Object.entries(dbRecord.formats)) {
            if (formatData && typeof formatData === 'object' && formatData.url) {
              const formatKey = 'uploads/' + path.basename(formatData.url);
              formats[formatName] = {
                ...formatData,
                url: toCdnUrl(formatKey, R2.cdnUrl),
              };
            } else {
              formats[formatName] = formatData;
            }
          }
        }

        const updateData = {
          url: cdnUrl,
          provider: 'aws-s3',
        };
        if (formats) {
          updateData.formats = formats;
        }

        await strapi.db.query('plugin::upload.file').update({
          where: { id: dbRecord.id },
          data: updateData,
        });

        dbUpdated++;
        console.log(`  ${oldUrl} → ${cdnUrl}`);
      } catch (err) {
        dbErrors++;
        console.error(`  ERROR updating DB record id=${dbRecord.id}: ${err.message}`);
      }
    }

    console.log(`\n[R2 Migration] DB update phase complete: ${dbUpdated} records updated, ${dbErrors} errors`);
  }

  // ── 7. Summary ───────────────────────────────────────────────
  console.log('\n========================================');
  console.log('[R2 Migration] SUMMARY');
  console.log('========================================');
  console.log(`  Local files found:   ${localFiles.length}`);
  console.log(`  Files uploaded:      ${uploadedCount}`);
  console.log(`  Bytes uploaded:      ${formatBytes(uploadedBytes)}`);
  console.log(`  DB records updated:  ${matched.length}`);
  console.log(`  Errors:              ${errorCount}`);
  if (DRY_RUN) console.log('  Mode:                DRY RUN (no writes)');
  console.log('========================================\n');

  if (!DRY_RUN && errorCount === 0) {
    console.log('[R2 Migration] ✓ All done. Files are now served from Cloudflare R2 CDN.');
    console.log(`[R2 Migration]   CDN base URL: ${R2.cdnUrl}`);
  } else if (!DRY_RUN && errorCount > 0) {
    console.log('[R2 Migration] ⚠ Completed with errors — check logs above.');
  }

  await app.destroy();
  process.exit(errorCount > 0 ? 1 : 0);
}

/** Simple MIME type guess based on file extension. */
function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

main().catch((err) => {
  console.error('[R2 Migration] Fatal error:', err);
  process.exit(1);
});
