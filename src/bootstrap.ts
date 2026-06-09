/**
 * Application bootstrap.
 * Called once on first run.
 *
 * B2B project — starts clean, no template seed data.
 */
export async function bootstrap() {
  const isFirst = await isFirstRun();
  if (isFirst) {
    try {
      console.log('[B2B CMS] First run — clean start, no seed data imported.');
    } catch (error) {
      console.log('Bootstrap error:', error);
    }
  }
}

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  });
  const initHasRun = await pluginStore.get({ key: 'initHasRun' });
  await pluginStore.set({ key: 'initHasRun', value: true });
  return !initHasRun;
}
