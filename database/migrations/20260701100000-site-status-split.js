'use strict';

/**
 * Site status field migration
 *
 * Migrates the legacy user-defined `status` column on `sites` to the new
 * `lifecycle_state` column, and seeds `is_published` based on the old value.
 *
 * This migration is idempotent and safe to run multiple times.
 */

async function up(knex) {
  const hasStatus = await knex.schema.hasColumn('sites', 'status');
  const hasLifecycleState = await knex.schema.hasColumn('sites', 'lifecycle_state');
  const hasIsPublished = await knex.schema.hasColumn('sites', 'is_published');

  if (!hasStatus) {
    // Nothing to migrate; the old column is already gone.
    return;
  }

  if (!hasLifecycleState) {
    await knex.schema.table('sites', (table) => {
      table.string('lifecycle_state');
    });
  }

  if (!hasIsPublished) {
    await knex.schema.table('sites', (table) => {
      table.boolean('is_published').defaultTo(false);
    });
  }

  // Migrate values from the legacy status column.
  // active/inactive/development -> lifecycle_state; active -> is_published true.
  await knex.raw(`
    UPDATE sites
    SET
      lifecycle_state = COALESCE(NULLIF(TRIM(status), ''), 'development'),
      is_published = CASE
        WHEN LOWER(status) = 'active' THEN true
        ELSE false
      END
    WHERE lifecycle_state IS NULL OR lifecycle_state = '';
  `);

  // Drop the legacy column once data is copied.
  await knex.schema.table('sites', (table) => {
    table.dropColumn('status');
  });
}

async function down(knex) {
  const hasStatus = await knex.schema.hasColumn('sites', 'status');
  const hasLifecycleState = await knex.schema.hasColumn('sites', 'lifecycle_state');
  const hasIsPublished = await knex.schema.hasColumn('sites', 'is_published');

  if (!hasStatus) {
    await knex.schema.table('sites', (table) => {
      table.string('status');
    });
  }

  // Reconstruct the legacy status column. User-controlled `is_published`
  // takes precedence: when true, status becomes 'active'.
  if (hasLifecycleState || hasIsPublished) {
    await knex.raw(`
      UPDATE sites
      SET status = CASE
        WHEN is_published = true THEN 'active'
        ELSE COALESCE(NULLIF(TRIM(lifecycle_state), ''), 'development')
      END
      WHERE status IS NULL OR status = '';
    `);
  }

  if (hasLifecycleState) {
    await knex.schema.table('sites', (table) => {
      table.dropColumn('lifecycle_state');
    });
  }

  if (hasIsPublished) {
    await knex.schema.table('sites', (table) => {
      table.dropColumn('is_published');
    });
  }
}

module.exports = { up, down };
