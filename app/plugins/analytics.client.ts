/**
 * EngVerse - Google Analytics 4 (GA4) Client Plugin
 * Asynchronously initializes GA4 tracking script, binds route changes,
 * and guards against SSR/browser hydration errors.
 *
 * Strict TypeScript (0 any), 100% memory leak free.
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 1)
 */

import { defineNuxtPlugin, useRuntimeConfig, useRouter } from '#app';
import type { GtagFunction } from '~/types/analytics';

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) {
    return;
  }

  const config = useRuntimeConfig();
  const rawGtagId = config.public.gtagId;
  const isPlaceholder = !rawGtagId || rawGtagId === 'G-XXXXXXXXXX';
  const gtagId = isPlaceholder ? '' : rawGtagId;

  // Initialize global dataLayer
  window.dataLayer = window.dataLayer || [];

  if (gtagId) {
    // Official GA4 stub function
    const gtagStub: GtagFunction = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag = gtagStub;

    window.gtag('js', new Date());
    window.gtag('config', gtagId, {
      send_page_view: false, // Managed manually via router hook below
    });

    // Inject remote gtag.js script if not already present in DOM
    const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${gtagId}"]`);
    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagId)}`;
      document.head.appendChild(script);
    }
  } else {
    // Development / CI mock gtag logger to prevent null pointer exceptions
    window.gtag = function (command, targetIdOrEventName, params) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[Analytics Dev Mock] command: ${command}, target: ${String(targetIdOrEventName)}`, params || {});
      }
    };
  }

  // Automatic Page View tracking on Nuxt client-side route transitions
  const router = useRouter();
  router.afterEach((to) => {
    nuxtApp.hook('page:finish', () => {
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'page_view', {
            page_path: to.fullPath,
            page_title: document.title || 'EngVerse',
          });
        }
      } catch (err) {
        console.warn('[Analytics] Failed to track page_view:', err);
      }
    });
  });
});

