/**
 * Site content-type lifecycles.
 * Auto-manages system fields on create/update.
 */
export default {
  async beforeCreate(event: any) {
    // Force status to "development" on every creation.
    // Status is a system-managed field, not user-facing.
    const { data } = event.params;
    data.status = 'development';
  },

  async beforeUpdate(event: any) {
    // Prevent status from being cleared during updates.
    const { data } = event.params;
    if (data.status === '' || data.status === null || data.status === undefined) {
      delete data.status;
    }
  },
};
