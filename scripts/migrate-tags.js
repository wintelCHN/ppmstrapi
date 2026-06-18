/**
 * Tag Migration Script
 *
 * Converts existing Product.tags_json_deprecated (or old Product.tags JSON arrays)
 * into the new Tag content type with proper document relations.
 *
 * Usage:  npm run migrate-tags
 *         or: node scripts/migrate-tags.js
 *
 * The script bootstraps a Strapi instance, iterates all products with
 * legacy tag arrays, find-or-creates Tag documents, links them to
 * products via the new M:N relation, and outputs a summary report.
 */

const strapi = require('@strapi/strapi');

async function main() {
  const app = await strapi().load();
  await app.bootstrap();

  console.log('[Migration] Starting tag migration...');
  console.log('[Migration] Searching for products with legacy tag JSON...');

  // Paginate through all products
  let allProducts = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const products = await strapi.documents('api::product.product').findMany({
      limit: pageSize,
      start: (page - 1) * pageSize,
      populate: ['site'],
    });
    allProducts = allProducts.concat(products);
    if (products.length < pageSize) break;
    page++;
  }

  console.log(`[Migration] Found ${allProducts.length} total products`);

  const tagMap = new Map(); // normalized lowercase name -> Tag document
  let tagsCreated = 0;
  let tagsLinked = 0;
  let productsLinked = 0;
  let productsSkipped = 0;
  let errors = 0;

  for (const product of allProducts) {
    const p = product;
    // Check both the deprecated field and the old `tags` JSON field
    const tagField = p.tags_json_deprecated ?? p.tags;

    if (!Array.isArray(tagField) || tagField.length === 0) {
      productsSkipped++;
      continue;
    }

    const tagDocIds = [];

    for (const tagName of tagField) {
      if (!tagName || typeof tagName !== 'string' || !tagName.trim()) continue;
      const normalized = tagName.trim();
      const key = normalized.toLowerCase();

      try {
        if (!tagMap.has(key)) {
          // Find existing tag (case-insensitive)
          let existing = await strapi.documents('api::tag.tag').findFirst({
            filters: { name: normalized },
          });

          if (!existing) {
            // Create new Tag document
            const siteDocId = p.site?.documentId ?? null;
            existing = await strapi.documents('api::tag.tag').create({
              data: {
                name: normalized,
                tagtype: 'product_type',
                ...(siteDocId ? { site: { documentId: siteDocId } } : {}),
              },
            });
            tagsCreated++;
            console.log(`[Migration] Created tag: "${normalized}"`);
          }

          tagMap.set(key, existing);
        }

        const tag = tagMap.get(key);
        if (tag && !tagDocIds.find((t) => t.documentId === tag.documentId)) {
          tagDocIds.push({ documentId: tag.documentId });
        }
      } catch (err) {
        console.error(`[Migration] Error resolving tag "${normalized}" for product ${p.documentId}: ${err.message}`);
        errors++;
      }
    }

    // Link tags to product
    if (tagDocIds.length > 0) {
      try {
        await strapi.documents('api::product.product').update({
          documentId: p.documentId,
          data: { tags: tagDocIds },
        });
        productsLinked++;
        tagsLinked += tagDocIds.length;
      } catch (err) {
        console.error(`[Migration] Error updating product ${p.documentId}: ${err.message}`);
        errors++;
      }
    }
  }

  // ── Summary ──
  console.log('\n========================================');
  console.log('[Migration] COMPLETE');
  console.log('========================================');
  console.log(`  Tags created:        ${tagsCreated}`);
  console.log(`  Total unique tags:   ${tagMap.size}`);
  console.log(`  Tags linked:         ${tagsLinked}`);
  console.log(`  Products linked:     ${productsLinked}`);
  console.log(`  Products skipped:    ${productsSkipped} (no legacy tags)`);
  console.log(`  Errors:              ${errors}`);
  console.log('========================================\n');

  if (errors > 0) {
    console.warn('[Migration] Some errors occurred — check logs above.');
  } else {
    console.log('[Migration] All done. You can now remove the tags_json_deprecated field from Product schema.');
  }

  await app.destroy();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
