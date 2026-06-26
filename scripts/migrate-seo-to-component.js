/**
 * SEO Field Migration: Flat Fields → meta.metadata Component
 *
 * Copies existing flat seo_* fields into the new metadata component
 * for all content types. Old fields are preserved — they will be
 * removed later in the cleanup phase.
 *
 * Usage:
 *   node scripts/migrate-seo-to-component.js           → run migration
 *   node scripts/migrate-seo-to-component.js --dry     → preview only
 *
 * Run AFTER Strapi has been restarted with the new schema changes
 * (Phase 2 — metadata field added to each content type).
 */

const DRY_RUN = process.argv.includes('--dry')

// Will be set after Strapi loads
let app

// ── Content type config ──────────────────────────────────────────

/**
 * Each entry maps a content type UID to:
 *   @param {object} mapping      field → old flat column → new metadata key
 *   @param {boolean} i18n        whether the type has i18n (affects query strategy)
 */
const MIGRATION_CONFIG = [
  {
    uid: 'api::product.product',
    i18n: true,
    mapping: [
      ['seo_title', 'metaTitle'],
      ['seo_description', 'metaDescription'],
      ['seo_keywords', 'metaKeywords'],
    ],
    fallbackTitle: (entry) => entry.name ?? '',
  },
  {
    uid: 'api::category.category',
    i18n: true,
    mapping: [
      ['seo_title', 'metaTitle'],
      ['seo_description', 'metaDescription'],
      ['seo_keywords', 'metaKeywords'],
    ],
    fallbackTitle: (entry) => entry.name ?? '',
  },
  {
    uid: 'api::blog.blog',
    i18n: true,
    mapping: [
      ['seo_title', 'metaTitle'],
      ['seo_description', 'metaDescription'],
      ['seo_keywords', 'metaKeywords'],
    ],
    fallbackTitle: (entry) => entry.title ?? '',
  },
  {
    uid: 'api::news.news',
    i18n: true,
    mapping: [
      ['seo_title', 'metaTitle'],
      ['seo_description', 'metaDescription'],
      ['seo_keywords', 'metaKeywords'],
    ],
    fallbackTitle: (entry) => entry.title ?? '',
  },
  {
    uid: 'api::site.site',
    i18n: false,
    mapping: [
      ['seo_default_title', 'metaTitle'],
      ['seo_default_description', 'metaDescription'],
      ['seo_default_keywords', 'metaKeywords'],
    ],
    fallbackTitle: (entry) => entry.name ?? '',
  },
  {
    uid: 'api::tag.tag',
    i18n: true,
    mapping: [
      ['seotitle', 'metaTitle'],
      ['metadesc', 'metaDescription'],
    ],
    fallbackTitle: (entry) => entry.name ?? '',
  },
]

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Fetch all entries for a content type, handling both i18n and non-i18n types.
 * For i18n types, fetches all locales.
 */
async function fetchAll(uid, i18n) {
  // Use db.query() for reliable programmatic access — returns all records
  // including all locale variants for i18n types
  const rows = await app.db.query(uid).findMany({
    select: ['id', 'documentId', 'locale'],
    where: {},
  })

  // Fetch full entries with metadata populated
  const results = []
  for (const row of rows) {
    try {
      // Use db.query to get the full row with components populated
      const full = await app.db.query(uid).findOne({
        where: { id: row.id },
        populate: ['metadata'],
      })
      if (full) {
        results.push({ ...full, documentId: row.documentId, locale: row.locale })
      }
    } catch {
      // skip rows that can't be fetched
    }
  }

  return results
}

/** Build metadata component from flat fields via mapping. */
function buildMetadata(entry, mapping, fallbackTitle) {
  const meta = {}

  for (const [oldField, newField] of mapping) {
    meta[newField] = entry[oldField] ?? ''
  }

  // metaTitle and metaDescription are required by schema — ensure non-empty
  if (!meta.metaTitle || meta.metaTitle.trim() === '') {
    meta.metaTitle = fallbackTitle || ''
  }
  if (!meta.metaDescription || meta.metaDescription.trim() === '') {
    meta.metaDescription = meta.metaTitle || ''
  }

  // Add defaults for fields that don't have old data
  if (meta.metaKeywords === undefined) meta.metaKeywords = ''
  meta.twitterCardType = 'summary'
  meta.twitterUsername = ''

  return meta
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log('=== DRY RUN — no changes will be made ===\n')
  }

  let totalMigrated = 0
  let totalSkipped = 0

  for (const config of MIGRATION_CONFIG) {
    const { uid, i18n, mapping, fallbackTitle } = config
    const label = uid.replace('api::', '').replace('.', ' / ')

    console.log(`\n── Processing: ${uid} ──`)

    const entries = await fetchAll(uid, i18n)
    console.log(`  Found ${entries.length} entries (including all locales)`)

    let entryMigrated = 0
    let entrySkipped = 0

    for (const entry of entries) {
      const localeTag = entry.locale ? ` [${entry.locale}]` : ''
      const entryLabel = `${entry.documentId}${localeTag}`

      // Skip if metadata already has content (previously migrated)
      if (entry.metadata?.metaTitle && entry.metadata.metaTitle.trim() !== '') {
        entrySkipped++
        continue
      }

      const newMetadata = buildMetadata(entry, mapping, fallbackTitle(entry))

      if (DRY_RUN) {
        console.log(`  [DRY] ${entryLabel}:`)
        console.log(`    metaTitle:       "${newMetadata.metaTitle}"`)
        console.log(`    metaDescription: "${newMetadata.metaDescription?.substring(0, 60)}..."`)
        console.log(`    metaKeywords:    "${newMetadata.metaKeywords?.substring(0, 60)}..."`)
      } else {
        try {
          await app.db.query(uid).update({
            where: { id: entry.id },
            data: { metadata: newMetadata },
          })
        } catch (err) {
          console.error(`  ✗ Failed ${entryLabel}: ${err.message}`)
          continue
        }
      }

      entryMigrated++
    }

    console.log(`  ${DRY_RUN ? '[DRY] ' : ''}Migrated: ${entryMigrated} | Skipped: ${entrySkipped}`)
    totalMigrated += entryMigrated
    totalSkipped += entrySkipped
  }

  console.log(`\n=== ${DRY_RUN ? 'DRY RUN COMPLETE' : 'MIGRATION COMPLETE'} ===`)
  console.log(`Total migrated: ${totalMigrated} | Skipped: ${totalSkipped}`)

  if (!DRY_RUN) {
    console.log('Run with --dry to preview changes without writing.')
  }
}

// ── Bootstrap & Run ──────────────────────────────────────────────

const { createStrapi } = require('@strapi/strapi')

createStrapi({ distDir: './dist' })
  .load()
  .then((instance) => {
    app = instance
    return main()
  })
  .then(() => {
    console.log('\nDone.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
