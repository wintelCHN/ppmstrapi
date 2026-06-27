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

    // ── Product media: larger preview in Content Manager ──
    // Strapi's media carousel uses a 124px slide height by default. Product
    // images and videos need more room for visual inspection, so scope the
    // override to the Product edit view's `Images` and `Videos` fields only.
    const PRODUCT_EDIT_ROUTE = '/content-manager/collection-types/api::product.product';
    const PRODUCT_MEDIA_STYLE_ID = 'b2b-product-media-preview-style';
    const PRODUCT_MODEL_UID = 'api::product.product';
    const PRODUCT_MEDIA_VIDEO_PREVIEW_CLASS = 'b2b-product-video-preview';
    let productVideoPreviewKey = '';
    let productVideoPreviewUrls: string[] = [];
    let productVideoPreviewRequest: Promise<string[]> | null = null;

    function ensureProductMediaPreviewStyles() {
      if (document.getElementById(PRODUCT_MEDIA_STYLE_ID)) return;

      const style = document.createElement('style');
      style.id = PRODUCT_MEDIA_STYLE_ID;
      style.textContent = `
        section[data-b2b-product-media-carousel="true"] [role="group"][aria-roledescription="slide"] {
          height: 300px !important;
          min-height: 300px !important;
        }

        section[data-b2b-product-media-carousel="true"] img {
          width: 300px !important;
          height: 300px !important;
          max-width: 100% !important;
          object-fit: contain !important;
        }

        section[data-b2b-product-media-carousel="true"] video,
        section[data-b2b-product-media-carousel="true"] canvas {
          width: auto !important;
          height: 300px !important;
          max-width: 100% !important;
          object-fit: contain !important;
        }

        section[data-b2b-product-media-carousel="true"] [data-b2b-product-media-actions="true"] {
          position: static !important;
          inset: auto !important;
          width: 100% !important;
          margin-top: 8px;
          justify-content: center !important;
          align-items: center !important;
        }

        section[data-b2b-product-media-carousel="true"] [data-b2b-product-media-actions="true"] button {
          min-height: unset !important;
        }

        section[data-b2b-product-media-carousel="true"] .${PRODUCT_MEDIA_VIDEO_PREVIEW_CLASS} {
          display: block;
          width: auto !important;
          height: 300px !important;
          max-width: 100% !important;
          margin: 0 auto;
          background: #000;
          object-fit: contain !important;
        }
      `;
      document.head.appendChild(style);
    }

    function isProductEditView() {
      return window.location.href.includes(PRODUCT_EDIT_ROUTE);
    }

    function getAdminToken() {
      const storedToken = window.localStorage.getItem('jwtToken');
      if (!storedToken) return null;

      try {
        return JSON.parse(storedToken);
      } catch {
        return storedToken;
      }
    }

    function getProductDocumentId() {
      const pathMatch = window.location.pathname.match(
        /\/content-manager\/collection-types\/api::product\.product\/([^/?#]+)/,
      );

      return pathMatch?.[1] ?? null;
    }

    function getProductLocale() {
      const locale = new URLSearchParams(window.location.search).get('plugins[i18n][locale]');
      return locale || undefined;
    }

    function mediaUrlFromFile(file: unknown) {
      if (!file || typeof file !== 'object') return null;

      const url = (file as { url?: unknown }).url;
      if (typeof url !== 'string' || !url) return null;

      if (/^(?:[a-z+]+:)?\/\//i.test(url)) return url;

      const backendUrl = window.strapi?.backendURL ?? window.location.origin;
      return `${backendUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
    }

    async function fetchProductVideoPreviewUrls() {
      const documentId = getProductDocumentId();
      if (!documentId) return [];

      const locale = getProductLocale();
      const cacheKey = `${documentId}:${locale ?? ''}`;
      if (cacheKey === productVideoPreviewKey) return productVideoPreviewUrls;

      if (productVideoPreviewRequest) return productVideoPreviewRequest;

      const token = getAdminToken();
      if (!token) return [];

      productVideoPreviewRequest = (async () => {
        const params = new URLSearchParams();
        if (locale) params.set('plugins[i18n][locale]', locale);

        const queryString = params.toString();
        const backendUrl = window.strapi?.backendURL ?? window.location.origin;
        const requestUrl = `${backendUrl.replace(
          /\/$/,
          '',
        )}/content-manager/collection-types/${PRODUCT_MODEL_UID}/${documentId}${
          queryString ? `?${queryString}` : ''
        }`;

        try {
          const response = await fetch(requestUrl, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) return [];

          const payload = await response.json();
          const videos = payload?.data?.videos ?? payload?.videos ?? [];
          const files = Array.isArray(videos) ? videos : videos ? [videos] : [];
          const urls = files
            .map((file) => mediaUrlFromFile(file))
            .filter((url): url is string => Boolean(url));

          productVideoPreviewKey = cacheKey;
          productVideoPreviewUrls = urls;
          return urls;
        } catch {
          return [];
        } finally {
          productVideoPreviewRequest = null;
        }
      })();

      return productVideoPreviewRequest;
    }

    function syncVideoPreviews(section: HTMLElement, videoUrls: string[]) {
      if (!videoUrls.length) return;

      const slides = Array.from(
        section.querySelectorAll<HTMLElement>('[role="group"][aria-roledescription="slide"]'),
      );

      slides.forEach((slide, index) => {
        if (slide.querySelector(`video.${PRODUCT_MEDIA_VIDEO_PREVIEW_CLASS}`)) return;

        const videoUrl = videoUrls[index] ?? videoUrls[0];
        if (!videoUrl) return;

        const video = document.createElement('video');
        video.className = PRODUCT_MEDIA_VIDEO_PREVIEW_CLASS;
        video.src = videoUrl;
        video.controls = true;
        video.muted = true;
        video.preload = 'metadata';
        video.playsInline = true;

        const actions = slide.querySelector<HTMLElement>('[data-b2b-product-media-actions="true"]');
        if (actions) {
          actions.parentElement?.insertBefore(video, actions);
        } else {
          slide.insertBefore(video, slide.firstChild);
        }
      });
    }

    function enhanceProductMediaPreview() {
      ensureProductMediaPreviewStyles();

      document
        .querySelectorAll<HTMLElement>('section[data-b2b-product-media-carousel="true"]')
        .forEach((section) => {
          section.removeAttribute('data-b2b-product-media-carousel');
          section
            .querySelectorAll<HTMLElement>('[data-b2b-product-media-actions="true"]')
            .forEach((actions) => {
              actions.removeAttribute('data-b2b-product-media-actions');
            });
        });

      if (!isProductEditView()) return;

      document
        .querySelectorAll<HTMLElement>('section[aria-roledescription="carousel"]')
        .forEach((section) => {
          const label = section.getAttribute('aria-label')?.trim() ?? '';
          if (/^(Images|Videos)(?:\s*\(|$)/i.test(label)) {
            section.setAttribute('data-b2b-product-media-carousel', 'true');
            const actionButtons = Array.from(
              section.querySelectorAll<HTMLButtonElement>('button[aria-label]'),
            ).filter((button) => {
              const actionLabel = button.getAttribute('aria-label')?.trim().toLowerCase();
              return ['add', 'copy link', 'delete', 'edit'].includes(actionLabel ?? '');
            });
            let actionContainer = actionButtons[0]?.parentElement;
            while (actionContainer && actionContainer !== section) {
              if (actionButtons.every((button) => actionContainer?.contains(button))) {
                actionContainer.setAttribute('data-b2b-product-media-actions', 'true');
                break;
              }
              actionContainer = actionContainer.parentElement;
            }

            if (/^Videos(?:\s*\(|$)/i.test(label)) {
              fetchProductVideoPreviewUrls().then((videoUrls) => {
                syncVideoPreviews(section, videoUrls);
              });
            }
          }
        });
    }

    enhanceProductMediaPreview();
    new MutationObserver(() => enhanceProductMediaPreview()).observe(
      document.body,
      { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] },
    );

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
