import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      // Prevent bundler from trying to resolve optional SDK at build time
      external: ['@wasmer/sdk']
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
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
          // Cache Wasmer SDK from common CDNs
          {
            urlPattern: new RegExp('^https://(esm\\.sh|cdn\\.jsdelivr\\.net|unpkg\\.com|cdn\\.skypack\\.dev|esm\\.run)/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasmer-sdk',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          // Cache Wasmer registry packages
          {
            urlPattern: new RegExp('^https://registry\\.wasmer\\.io/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasmer-registry',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          // Cache Pyodide (Python in WebAssembly) assets for offline usage
          {
            // Support both npm and official /pyodide/v paths
            urlPattern: new RegExp('^https://cdn\\.jsdelivr\\.net/(npm/pyodide@|pyodide/v)'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 14 }
            }
          },
          // Cache local vendor mirror of Pyodide for offline usage
          {
            urlPattern: new RegExp('^/vendor/pyodide/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-local',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Cache Wasmer Web Shell (webassembly.sh) resources for offline usage
          {
            urlPattern: new RegExp('^https://webassembly\\.sh/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'webassembly-sh',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'maskable-icon-512x512.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gemini Web Wrapper - GitHub Editor',
        short_name: 'Gemini GitHub',
        description: 'Mobile-First AI Editor for GitHub with Gemini',
        theme_color: '#000000',
        background_color: '#000000',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
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
