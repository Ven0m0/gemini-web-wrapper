import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      // Proxy API requests to the backend API server
      '/v1': {
        target: process.env.API_URL || 'http://localhost:9000',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.API_URL || 'http://localhost:9000',
        changeOrigin: true,
      },
    }
  },
  define: (() => {
    // Build timestamp in Asia/Taipei (UTC+8), minute precision
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date())
      const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
      const yyyy = get('year')
      const mm = get('month')
      const dd = get('day')
      const hh = get('hour')
      const mi = get('minute')
      const friendly = `${yyyy}-${mm}-${dd} ${hh}:${mi} Taipei`
      return { __BUILD_TIME__: JSON.stringify(friendly) }
    } catch {
      // Fallback to UTC if Intl is unavailable
      const d = new Date()
      const yyyy = d.getUTCFullYear()
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mi = String(d.getUTCMinutes()).padStart(2, '0')
      const friendly = `${yyyy}-${mm}-${dd} ${hh}:${mi} Taipei`
      return { __BUILD_TIME__: JSON.stringify(friendly) }
    }
  })(),
  plugins: [
    react(),
    VitePWA({
      // Avoid terser/minify issues in some environments
      minify: false,
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /^\/v1\//, /^\/api\//, /^\/health$/, /\/[^/?]+\.[^/]+$/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
              plugins: [
                {
                  handlerDidError: async () => {
                    return await caches.match('/offline.html')
                  }
                }
              ]
            }
          },
          // Google Fonts: stylesheet revalidates, font files are immutable
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      includeAssets: ['apple-touch-icon.png', 'icons/*.svg'],
      manifest: {
        name: 'Gemini Web Wrapper - GitHub Editor',
        short_name: 'Gemini GitHub',
        description: 'Mobile-First AI Editor for GitHub with Gemini',
        theme_color: '#000000',
        background_color: '#000000',
        id: '/',
        scope: '/',
        display: 'standalone',
        start_url: '/',
        categories: ['developer', 'productivity', 'utilities'],
        lang: 'en',
        prefer_related_applications: false,
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  base: '/'
})
