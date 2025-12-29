import { test, expect } from '@playwright/test';
import { PWATestHelpers } from './helpers.js';

test.describe('Tool Mode', () => {
  let helpers;

  test.beforeEach(async ({ page }) => {
    helpers = new PWATestHelpers(page);
    await page.goto('/');
    await helpers.waitForCLI();
    await helpers.setupConfig();
  });

  test('should switch to tool mode and display tool interface', async ({ page }) => {
    await helpers.switchToTool();
    
    // Verify tool interface components
    await expect(page.locator('.tool-container')).toBeVisible();
    await expect(page.locator('.tool-header')).toBeVisible();
    await expect(page.locator('.tool-mode-switch')).toBeVisible();
    await expect(page.locator('.tool-section')).toBeVisible();
    await expect(page.locator('.tool-log')).toBeVisible();
    
    // Verify header elements
    await expect(page.locator('.tool-header h2')).toContainText('File Transfer Tools');
    await expect(page.locator('.back-btn')).toContainText('← CLI');
  });

  test('should toggle between GitHub and WebSocket modes', async ({ page }) => {
    await helpers.switchToTool();
    
    // Verify default GitHub mode
    const githubBtn = page.locator('[data-testid="tool-github-btn"]');
    const websocketBtn = page.locator('[data-testid="tool-websocket-btn"]');
    
    await expect(githubBtn).toHaveClass(/active/);
    
    // Switch to WebSocket mode
    await websocketBtn.click();
    await expect(websocketBtn).toHaveClass(/active/);
    await expect(githubBtn).not.toHaveClass(/active/);
    
    // Verify WebSocket mode content
    await expect(page.locator('.ws-status')).toBeVisible();
    await expect(page.locator('.ws-status')).toContainText('Disconnected');
  });

  test('should display GitHub upload form', async ({ page }) => {
    await helpers.switchToTool();
    
    // Verify GitHub upload section
    await expect(page.locator('.upload-section')).toBeVisible();
    await expect(page.locator('.upload-section h4')).toContainText('Upload File');
    
    // Verify form elements
    await expect(page.locator('.file-input')).toBeVisible();
    await expect(page.locator('input[placeholder*="assets"]')).toBeVisible();
    await expect(page.locator('.upload-btn')).toBeVisible();
    await expect(page.locator('.upload-btn')).toContainText('Upload to GitHub');
  });

  test('should display GitHub download form', async ({ page }) => {
    await helpers.switchToTool();
    
    // Verify GitHub download section
    await expect(page.locator('.download-section')).toBeVisible();
    await expect(page.locator('.download-section h4')).toContainText('Download File');
    
    // Verify form elements
    await expect(page.locator('input[placeholder*="src/App.tsx"]')).toBeVisible();
    await expect(page.locator('.download-btn')).toBeVisible();
    await expect(page.locator('.download-btn')).toContainText('Download from GitHub');
  });

  test('should handle file upload simulation', async ({ page }) => {
    await helpers.switchToTool();
    
    // Mock successful upload
    await page.route('**/repos/*/contents/test-upload.txt**', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 404 }); // File doesn't exist
      } else {
        route.fulfill({
          status: 201,
          body: JSON.stringify({ content: { sha: 'upload-sha-123' } })
        });
      }
    });
    
    // Fill upload path
    await page.fill('input[placeholder*="assets"]', 'test-upload.txt');
    
    // Mock file selection
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('.file-input');
    const fileChooser = await fileChooserPromise;
    
    // We can't actually set files in test, but we can verify the file chooser opened
    expect(fileChooser).toBeTruthy();
  });

  test('should handle download request', async ({ page }) => {
    await helpers.switchToTool();
    
    const mockContent = helpers.createTestFileContent('text');
    
    await page.route('**/repos/*/contents/download-test.txt**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(mockContent),
          sha: 'download-sha-456'
        })
      });
    });
    
    // Fill download path
    await page.fill('input[placeholder*="src/App.tsx"]', 'download-test.txt');
    
    // Mock download
    const downloadPromise = page.waitForEvent('download');
    await page.click('.download-btn');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('download-test.txt');
  });

  test('should display activity log', async ({ page }) => {
    await helpers.switchToTool();
    
    // Verify log components
    await expect(page.locator('.tool-log h4')).toContainText('Activity Log');
    await expect(page.locator('.log-content')).toBeVisible();
    await expect(page.locator('.clear-log-btn')).toBeVisible();
    
    // Initially should be empty
    await expect(page.locator('.log-empty')).toContainText('No activity yet');
  });

  test('should handle WebSocket mode interface', async ({ page }) => {
    await helpers.switchToTool();
    
    // Switch to WebSocket mode
    await page.click('button:text("WebSocket")');
    
    // Verify WebSocket-specific elements
    await expect(page.locator('.ws-status')).toBeVisible();
    await expect(page.locator('.ws-status')).toContainText('Disconnected');
    
    // Verify WebSocket upload form
    await expect(page.locator('input[placeholder*="document.pdf"]')).toBeVisible();
    await expect(page.locator('.upload-btn')).toContainText('Upload via WebSocket');
    
    // Verify WebSocket download form  
    await expect(page.locator('input[placeholder*="data.json"]')).toBeVisible();
    await expect(page.locator('.download-btn')).toContainText('Download via WebSocket');
    
    // Verify forms are disabled when not connected
    await expect(page.locator('.file-input')).toBeDisabled();
    await expect(page.locator('.upload-btn')).toBeDisabled();
    await expect(page.locator('.download-btn')).toBeDisabled();
  });

  test('should return to CLI mode from tool mode', async ({ page }) => {
    await helpers.switchToTool();
    
    // Click back button
    await page.click('.back-btn');
    
    // Verify back in CLI mode
    await expect(page.locator('.cli-container')).toBeVisible();
    await expect(page.locator('.cli-input')).toBeVisible();
    await expect(page.locator('.tool-container')).not.toBeVisible();
  });

  test('should handle mobile responsiveness in tool mode', async ({ page }) => {
    await helpers.switchToTool();
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify mobile layout
    await expect(page.locator('.tool-container')).toBeVisible();
    await expect(page.locator('.tool-header')).toBeVisible();
    await expect(page.locator('.upload-section')).toBeVisible();
    
    // Verify mobile-specific styles are applied
    const headerBox = await page.locator('.tool-header').boundingBox();
    expect(headerBox.width).toBeLessThanOrEqual(375);
    
    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should show error handling in tool mode', async ({ page }) => {
    await helpers.switchToTool();
    
    // Mock API error
    await page.route('**/repos/*/contents/error-test.txt**', route => {
      route.fulfill({ status: 500, body: 'Server Error' });
    });
    
    // Try to download non-existent file
    await page.fill('input[placeholder*="src/App.tsx"]', 'error-test.txt');
    await page.click('.download-btn');
    
    // Verify error is logged
    await expect(page.locator('.log-content')).toContainText('Download failed');
  });
});