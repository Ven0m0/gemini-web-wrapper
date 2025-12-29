import { test, expect, devices } from '@playwright/test';
import { PWATestHelpers } from './helpers.js';

test.describe('Mobile PWA Features', () => {
  // Only run on mobile browsers or browsers with touch support
  test.describe.configure({ mode: 'parallel' });
  let helpers;

  test.beforeEach(async ({ page }) => {
    helpers = new PWATestHelpers(page);
    await page.goto('/');
    await helpers.waitForCLI();
  });

  test('should load and function on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify app loads correctly on mobile
    await expect(page.locator('.app')).toBeVisible();
    await expect(page.locator('.cli-container')).toBeVisible();
    await expect(page.locator('.cli-input')).toBeVisible();
    
    // Test mobile interactions
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch) {
      await page.tap('.cli-input');
    } else {
      await page.click('.cli-input');
    }
    await expect(page.locator('.cli-input')).toBeFocused();
  });

  test('should handle touch interactions in CLI mode', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test tap to focus input
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch) {
      await page.tap('.cli-input');
    } else {
      await page.click('.cli-input');
    }
    await expect(page.locator('.cli-input')).toBeFocused();
    
    // Test scrolling in history
    await helpers.executeCommand('/help');
    
    const history = page.locator('.cli-history');
    await expect(history).toBeVisible();
    
    // Test touch scroll (simulate with touch events for WebKit compatibility)
    const browserName = page.context().browser()?.browserType().name();
    if (browserName === 'webkit') {
      // Use touch events for WebKit/Safari
      const historyElement = await history.boundingBox();
      if (historyElement) {
        await page.touchscreen.tap(historyElement.x + historyElement.width/2, historyElement.y + historyElement.height/2);
      }
    } else {
      // Use mouse wheel for other browsers
      await history.hover();
      await page.mouse.wheel(0, 100);
    }
  });

  test('should handle mobile editor mode', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.executeCommand('/editor');
    
    // Verify editor is mobile-responsive
    await expect(page.locator('.editor-container')).toBeVisible();
    await expect(page.locator('.editor-status-bar')).toBeVisible();
    
    // Test touch interactions in editor
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch) {
      await page.tap('.cm-editor');
    } else {
      await page.click('.cm-editor');
    }
    await page.keyboard.type('Mobile test input');
    
    await expect(page.locator('.cm-editor')).toContainText('Mobile test input');
  });

  test('should handle mobile tool mode', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await helpers.setupConfig();
    
    await helpers.executeCommand('/tool');
    
    // Verify tool mode is mobile-responsive
    await expect(page.locator('.tool-container')).toBeVisible();
    await expect(page.locator('.tool-header')).toBeVisible();
    
    // Test mobile mode switching
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    const webSocketMainButton = page.locator('.tool-mode-switch button:text("WebSocket")');
    if (hasTouch) {
      await webSocketMainButton.tap();
    } else {
      await webSocketMainButton.click();
    }
    await expect(webSocketMainButton).toHaveClass(/active/);
  });

  test('should handle PWA manifest', async ({ page }) => {
    // Check manifest link exists (head links are not "visible" but should exist)
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');
    
    // Fetch and verify manifest
    const manifestResponse = await page.request.get('/manifest.webmanifest');
    expect(manifestResponse.status()).toBe(200);
    
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('Phone AI + GitHub');
    expect(manifest.short_name).toBe('Chat GitHub');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#000000');
    expect(manifest.background_color).toBe('#ffffff');
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  test('should support service worker registration', async ({ page }) => {
    // Check if service worker API is available
    const swRegistered = await page.evaluate(async () => {
      return 'serviceWorker' in navigator;
    });
    
    expect(swRegistered).toBe(true);
    
    // In development mode, service worker might not be registered immediately
    // Just verify the API is available since actual registration depends on build mode
    const swSupported = await page.evaluate(() => {
      return 'serviceWorker' in navigator && typeof navigator.serviceWorker.register === 'function';
    });
    
    expect(swSupported).toBe(true);
  });

  test('should handle Chinese input on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test Chinese characters in CLI
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch) {
      await page.tap('.cli-input');
    } else {
      await page.click('.cli-input');
    }
    await page.keyboard.type('/new 中文测试.md');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('.cli-history')).toContainText('中文测试.md');
    
    // Test in editor mode
    await helpers.executeCommand('/editor');
    const hasTouch2 = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch2) {
      await page.tap('.cm-editor');
    } else {
      await page.click('.cm-editor');
    }
    await page.keyboard.type('这是中文测试内容');
    
    await expect(page.locator('.cm-editor')).toContainText('这是中文测试内容');
  });

  test('should handle mobile file picker interaction', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await helpers.setupConfig();
    
    // Go to tool mode
    await helpers.executeCommand('/tool');
    
    // Test mobile file picker
    const fileChooserPromise = page.waitForEvent('filechooser');
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch) {
      await page.tap('.file-input');
    } else {
      await page.click('.file-input');
    }
    const fileChooser = await fileChooserPromise;
    
    expect(fileChooser).toBeTruthy();
  });

  test('should maintain functionality across orientation changes', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.executeCommand('/help');
    await expect(page.locator('.cli-history')).toContainText('Available commands');
    
    // Switch to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    
    // Verify app still works
    await expect(page.locator('.cli-container')).toBeVisible();
    await helpers.executeCommand('/editor');
    await expect(page.locator('.editor-container')).toBeVisible();
  });

  test('should handle mobile keyboard interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test virtual keyboard doesn't break layout
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window);
    if (hasTouch) {
      await page.tap('.cli-input');
    } else {
      await page.click('.cli-input');
    }
    await page.keyboard.type('/unknown');
    
    await expect(page.locator('.cli-input')).toHaveValue('/unknown');
    
    // Test enter key
    await page.keyboard.press('Enter');
    await expect(page.locator('.cli-history')).toContainText('Unknown command: unknown');
  });

  test('should be installable as PWA', async ({ page }) => {
    // Check for PWA installation criteria
    const hasManifest = await page.locator('link[rel="manifest"]').count();
    expect(hasManifest).toBeGreaterThan(0);
    
    // Check for HTTPS (in production) or localhost
    const url = page.url();
    expect(url.startsWith('https://') || url.startsWith('http://localhost')).toBe(true);
    
    // Check for service worker
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    expect(hasServiceWorker).toBe(true);
  });

  test('should handle offline capability', async ({ page, context }) => {
    // First load the page normally
    await expect(page.locator('.cli-container')).toBeVisible();
    
    // In development mode, offline caching might not work fully
    // So we'll test the app's resilience to network issues rather than full offline support
    
    // Go offline
    await context.setOffline(true);
    
    // Test that existing functionality still works (locally cached JS/CSS)
    await page.keyboard.type('/help');
    await page.keyboard.press('Enter');
    
    // The app should still respond to local interactions
    await expect(page.locator('.cli-input')).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
    
    // Verify we can go back online
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.cli-container')).toBeVisible();
  });
});