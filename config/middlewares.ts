import type { Core } from '@strapi/strapi';

const MAX_UPLOAD_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'https://cdn.productsb2b.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'https://cdn.productsb2b.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:4321',                    // Astro dev server
        'http://localhost:3000',
        'https://proneofishing.com',
        'https://www.proneofishing.com',
        'https://proneohunting.com',
        'https://www.proneohunting.com',
        // Vercel preview deployments (auto-generated URLs)
        /\.vercel\.app$/,
      ],
      methods: ['GET', 'POST', 'HEAD'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formidable: {
        maxFields: 5000,
        maxFileSize: MAX_UPLOAD_FILE_SIZE,
        maxTotalFileSize: MAX_UPLOAD_FILE_SIZE,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
