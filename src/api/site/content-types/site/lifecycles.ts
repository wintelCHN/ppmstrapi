/**
 * Site content-type lifecycles.
 * Auto-manages system fields on create/update.
 */
export default {
  async beforeCreate(event: any) {
    // Force lifecycle_state to "development" on every creation.
    // This is a system-managed field, hidden from the admin UI.
    const { data } = event.params || {};
    if (!data) return;
    data.lifecycle_state = 'development';
  },

  async beforeUpdate(event: any) {
    // Prevent lifecycle_state from being cleared during updates.
    // is_published is user-controlled and left untouched.
    const { data } = event.params || {};
    if (!data) return;
    if (
      data.lifecycle_state === '' ||
      data.lifecycle_state === null ||
      data.lifecycle_state === undefined
    ) {
      delete data.lifecycle_state;
    }
  },
};
