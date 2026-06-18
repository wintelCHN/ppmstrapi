// Polyfills for ES2023 Array methods
// Required for Strapi Admin components (i18n, content-manager, admin)
if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function <T>(compareFn?: (a: T, b: T) => number): T[] {
    if (compareFn === undefined) {
      return [...this].sort();
    }
    return [...this].sort(compareFn);
  };
}

if (!Array.prototype.toSpliced) {
  Array.prototype.toSpliced = function <T>(start: number, deleteCount?: number, ...items: T[]): T[] {
    const copy = [...this];
    copy.splice(start, deleteCount ?? 0, ...items);
    return copy;
  };
}

import type { StrapiApp } from '@strapi/strapi/admin';
import { Folder, PuzzlePiece, Cog } from '@strapi/icons';

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

  register(app: StrapiApp) {
    app.addMenuLink({
      to: 'categories',
      icon: Folder,
      intlLabel: {
        id: 'global.categories',
        defaultMessage: 'Categories',
      },
      permissions: [],
      Component: () =>
        import('./pages/CategoryTree').then((mod) => ({
          default: mod.CategoryTreePage,
        })),
    });

    // Tags — uses the native Content Manager for list / create / edit
    app.addMenuLink({
      to: 'content-manager/collection-types/api::tag.tag',
      icon: PuzzlePiece,
      intlLabel: {
        id: 'global.tags',
        defaultMessage: 'Tags',
      },
      permissions: [
        { action: 'plugin::content-manager.collection-types.configure-view', subject: null },
      ],
    });

    // Tag Tools — batch merge, CSV import/export, statistics
    app.addMenuLink({
      to: 'tag-tools',
      icon: Cog,
      intlLabel: {
        id: 'global.tag-tools',
        defaultMessage: 'Tag Tools',
      },
      permissions: [],
      Component: () =>
        import('./pages/TagTools').then((mod) => ({
          default: mod.TagToolsPage,
        })),
    });

    // Custom field registrations (if any) go here
  },

  bootstrap(app: StrapiApp) {
    console.log(app);
  },
};
