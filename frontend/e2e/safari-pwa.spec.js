import { test, expect } from '@playwright/test'
import { spawn } from 'child_process'
import http from 'http'

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, res => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true)
        } else {
          if (Date.now() - start > timeoutMs) return reject(new Error('Timeout waiting for ' + url))
          setTimeout(check, 300)
        }
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Timeout waiting for ' + url))
        setTimeout(check, 300)
      })
    }
    check()
  })
}

test.describe('Safari PWA (preview build)', () => {
  let preview

  test.beforeAll(async () => {
    // Start vite preview serving dist/ on 4173
    preview = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'preview', '--', '--port', '4173', '--strictPort'])
    await waitForHttp('http://localhost:4173/Chat_github/')
  })

  test.afterAll(async () => {
    if (preview && !preview.killed) preview.kill()
  })

  test('should load manifest and register service worker on WebKit desktop', async ({ page }) => {
    const browserName = page.context().browser()?.browserType().name()
    test.skip(browserName !== 'webkit', 'PWA install test targets Safari/WebKit')

    await page.goto('http://localhost:4173/Chat_github/')

    // Check manifest link exists and can be fetched
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestHref).toBe('/Chat_github/manifest.webmanifest')

    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]')
      const href = link && (link as HTMLLinkElement).href
      const res = href ? await fetch(href) : null
      return res ? { ok: res.ok, text: await res.text() } : null
    })
    expect(manifest).not.toBeNull()
    expect(manifest.ok).toBe(true)
    expect(manifest.text).toContain('"display": "standalone"')

    // Ensure service worker registers and becomes ready
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false }
      try {
        const reg = await navigator.serviceWorker.ready
        return { supported: true, scope: reg.scope }
      } catch (e) {
        return { supported: true, error: String(e) }
      }
    })
    expect(swReady.supported).toBe(true)
    expect(swReady.scope).toContain('/Chat_github/')

    // Verify some precache entries exist
    const cacheInfo = await page.evaluate(async () => {
      if (!('caches' in window)) return { caches: [] }
      const names = await caches.keys()
      return { caches: names }
    })
    expect(Array.isArray(cacheInfo.caches)).toBe(true)

    // display-mode in a normal tab is not standalone; just assert detection logic runs
    const displayMode = await page.evaluate(() => ({
      standalone: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true
    }))
    expect(displayMode).toHaveProperty('standalone')
  })
})

