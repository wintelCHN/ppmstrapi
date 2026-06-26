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
import { Folder, PuzzlePiece, Cog, GridNine } from '@strapi/icons';

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

    // Product Batch Tools — bulk edit site / category / MOQ
    app.addMenuLink({
      to: 'product-batch',
      icon: GridNine,
      intlLabel: {
        id: 'global.product-batch',
        defaultMessage: 'Product Batch',
      },
      permissions: [],
      Component: () =>
        import('./pages/ProductBatch').then((mod) => ({
          default: mod.ProductBatchPage,
        })),
    });

    // Custom field registrations (if any) go here
  },

  bootstrap(app: StrapiApp) {
    console.log(app);

    // ── Social Link: dynamic URL placeholder based on platform ──
    const PLATFORM_URLS: Record<string, string> = {
      X: 'https://x.com/xxxxx',
      linkedin: 'https://linkedin.com/in/xxxxx',
      facebook: 'https://facebook.com/xxxxx',
      instagram: 'https://instagram.com/xxxxx',
      youtube: 'https://youtube.com/@xxxxx',
      tiktok: 'https://tiktok.com/@xxxxx',
      whatsapp: 'https://wa.me/xxxxx',
      website: 'https://www.xxxxx.com',
    };

    /** Update the URL placeholder for a single social_links row */
    function syncUrlPlaceholder(index: number | string) {
      // Strapi 5 repeatable component field names: social_links.N.platform / social_links.N.url
      const platformEl = document.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`[name="social_links.${index}.platform"]`);
      const urlEl = document.querySelector<HTMLInputElement>(
        `[name="social_links.${index}.url"]`
      );
      if (platformEl && urlEl) {
        const platform = platformEl.value;
        urlEl.placeholder = PLATFORM_URLS[platform] || 'https://';
      }
    }

    /** Sync all existing social_links rows (initial load + after add/remove) */
    function syncAllUrlPlaceholders() {
      const platformInputs = document.querySelectorAll<
        HTMLInputElement | HTMLSelectElement
      >('[name$=".platform"]');
      platformInputs.forEach((el) => {
        const match = el.name.match(/^social_links\.(\d+)\.platform$/);
        if (match) syncUrlPlaceholder(match[1]);
      });
    }

    // 1) Change delegation — fires when user picks a different platform
    document.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      const match = target?.name?.match(
        /^social_links\.(\d+)\.platform$/
      );
      if (match) syncUrlPlaceholder(match[1]);
    });

    // 2) MutationObserver — fires when CM form renders or rows are added/removed
    const observer = new MutationObserver(() => {
      syncAllUrlPlaceholders();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 3) Initial sync (CM edit view may already be in DOM)
    syncAllUrlPlaceholders();
  },
};
