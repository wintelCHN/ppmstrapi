import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'content-type-builder': {
    enabled: env('NODE_ENV') === 'development',
  },
});

export default config;
