// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4,
  },

  devtools: {
    enabled: true,
  },

  typescript: {
    strict: true,
  },

  modules: [
    '@pinia/nuxt',
  ],

  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700&display=swap',
        },
      ],
    },
  },

  // Global Multi-Universe Styles
  css: [
    '~/assets/css/themes.css',
  ],

  // Component auto-import configuration without mandatory directory prefixing
  components: [
    {
      path: '~/components/common',
      pathPrefix: false,
    },
    {
      path: '~/components/worlds',
      pathPrefix: false,
    },
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  // Resource compression for high-performance delivery
  nitro: {
    compressPublicAssets: true,
  },

  // Route caching rules for Edge CDN and static assets (0 Firebase read quota)
  routeRules: {
    // Cache static stage & codex JSON files for 24 hours on CDN
    '/data/**': {
      headers: {
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    },
    // Cache Leaderboard API on Vercel Edge CDN for 1 hour with stale-while-revalidate
    '/api/leaderboard': {
      headers: {
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  },

  // Multi-layer runtime configuration:
  // Root keys are private (server-only, never leaked to client bundle).
  // Public keys are safe for client-side consumption.
  runtimeConfig: {
    // Private Server-side secrets
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.NUXT_GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || process.env.NUXT_GEMINI_MODEL || 'gemini-2.5-flash',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || process.env.NUXT_OPENROUTER_API_KEY || '',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || process.env.NUXT_FIREBASE_CLIENT_EMAIL || '',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || process.env.NUXT_FIREBASE_PRIVATE_KEY || '',
    turnstileSecretKey: process.env.NUXT_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || '',
    hmacSecretKey: process.env.HMAC_SECRET_KEY || process.env.NUXT_HMAC_SECRET_KEY || '',

    // Public Client-side variables (prefixed with NUXT_PUBLIC_*)
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '',
      gtagId: process.env.NUXT_PUBLIC_GTAG_ID || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
    },
  },
})
