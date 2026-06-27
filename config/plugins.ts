import type { Core } from '@strapi/strapi';

const MAX_UPLOAD_FILE_SIZE = 500 * 1024 * 1024; // 500MB

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
  // ── Upload provider ──────────────────────────────────────────────
  // UPLOAD_PROVIDER=local        → default local filesystem (dev)
  // UPLOAD_PROVIDER=aws-s3       → Cloudflare R2 via S3-compatible API (prod)
  upload: {
    config: {
      provider: env('UPLOAD_PROVIDER', 'local'),
      sizeLimit: MAX_UPLOAD_FILE_SIZE,
      providerOptions:
        env('UPLOAD_PROVIDER', 'local') === 'aws-s3'
          ? {
              s3Options: {
                credentials: {
                  accessKeyId: env('R2_ACCESS_KEY_ID', ''),
                  secretAccessKey: env('R2_SECRET_ACCESS_KEY', ''),
                },
                endpoint: env('R2_ENDPOINT', ''),
                region: env('R2_REGION', 'auto'),
                params: {
                  Bucket: env('R2_BUCKET', ''),
                },
              },
              // CDN custom domain → API returns absolute URLs like
              // https://cdn.productsb2b.com/uploads/xxx.png
              // Frontend mediaUrl() already passes absolute URLs through.
              baseUrl: env('R2_CDN_URL', ''),
            }
          : {},
    },
  },
});

export default config;
