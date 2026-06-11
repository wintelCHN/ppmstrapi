// Polyfill for Array.prototype.toSorted (ES2023)
// Required for Strapi Admin i18n LocaleListCell and Filters components
if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function <T>(compareFn?: (a: T, b: T) => number): T[] {
    if (compareFn === undefined) {
      return [...this].sort();
    }
    return [...this].sort(compareFn);
  };
}

import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [
      // 'ar',
      // 'fr',
      // 'cs',
      // 'de',
      // 'da',
      // 'es',
      // 'he',
      // 'id',
      // 'it',
      // 'ja',
      // 'ko',
      // 'ms',
      // 'nl',
      // 'no',
      // 'pl',
      // 'pt-BR',
      // 'pt',
      // 'ru',
      // 'sk',
      // 'sv',
      // 'th',
      // 'tr',
      // 'uk',
      // 'vi',
      // 'zh-Hans',
      // 'zh',
    ],
  },
  bootstrap(app: StrapiApp) {
    console.log(app);
  },
};
