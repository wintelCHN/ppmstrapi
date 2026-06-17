import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  i18n: {
    enabled: true,
  },
  translate: {
    enabled: true,
    config: {
      // Custom DeepSeek AI provider (free, uses existing API key)
      provider: env('TRANSLATE_PROVIDER', 'deepseek'),
      providerOptions: {
        apiKey: env('DEEPSEEK_API_KEY', ''),
        baseUrl: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
        model: env('DEEPSEEK_MODEL', 'deepseek-chat'),
      },
      // Field types to auto-translate (blocks = Strapi rich text editor)
      translatedFieldTypes: [
        'string',
        { type: 'blocks', format: 'jsonb' },
        { type: 'text', format: 'plain' },
        { type: 'richtext', format: 'markdown' },
        'component',
        'dynamiczone',
      ],
      translateRelations: true,
      regenerateUids: true,
    },
  },
});

export default config;
