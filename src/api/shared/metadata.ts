/**
 * Shared utility: ensure metadata.priority has a default value.
 *
 * Called from beforeCreate / beforeUpdate lifecycles.
 * Only intervenes when metadata is present in the mutation data
 * and priority is not explicitly set — never overwrites an
 * intentionally chosen value.
 */

export function ensureMetadataPriority(
  data: Record<string, any>,
  defaultPriority: number,
): void {
  // Only act when metadata is being set in this operation
  if (!data.metadata || typeof data.metadata !== 'object') return

  if (
    data.metadata.priority === undefined ||
    data.metadata.priority === null ||
    data.metadata.priority === ''
  ) {
    data.metadata.priority = defaultPriority
  }
}
