import { test, expect } from '@playwright/test';
import { PWATestHelpers } from './helpers.js';

test.describe('Basic PWA Workflows', () => {
  let helpers;

  test.beforeEach(async ({ page }) => {
    helpers = new PWATestHelpers(page);
    await page.goto('/');
    await helpers.waitForCLI();
  });

  test('should load PWA and display CLI interface', async ({ page }) => {
    // Verify initial load
    await expect(page.locator('.cli-container')).toBeVisible();
    await expect(page.locator('.cli-input')).toBeVisible();
    await expect(page.locator('.cli-history')).toBeVisible();
    
    // Verify placeholder text
    await expect(page.locator('.cli-input')).toHaveAttribute('placeholder');
    
    // Verify PWA features
    await helpers.verifyPWAFeatures();
  });

  test('should handle help command', async ({ page }) => {
    await helpers.executeCommand('/help');
    
    // Verify help content appears
    await expect(page.locator('.cli-history')).toContainText('Available commands:');
    await expect(page.locator('.cli-history')).toContainText('/open');
    await expect(page.locator('.cli-history')).toContainText('/editor');
    await expect(page.locator('.cli-history')).toContainText('/tool');
  });

  test('should clear CLI history', async ({ page }) => {
    // Add some commands first
    await helpers.executeCommand('/help');
    await helpers.executeCommand('/clear');
    
    // Verify history is cleared
    const historyText = await page.locator('.cli-history').textContent();
    expect(historyText.trim()).toBe('');
  });

  test('should handle unknown commands gracefully', async ({ page }) => {
    await helpers.executeCommand('/unknown-command');
    
    await expect(page.locator('.cli-history')).toContainText('Unknown command');
  });

  test('should switch between modes', async ({ page }) => {
    // Test switching to editor mode
    await helpers.executeCommand('/editor', 'Switched to editor mode');
    await expect(page.locator('.editor-container')).toBeVisible();
    
    // Switch back to CLI
    await page.click('.mode-btn');
    await expect(page.locator('.cli-container')).toBeVisible();
    
    // Test switching to tool mode
    await helpers.executeCommand('/tool', 'Switched to tool mode');
    await expect(page.locator('.tool-container')).toBeVisible();
    
    // Switch back to CLI
    await page.click('.back-btn');
    await expect(page.locator('.cli-container')).toBeVisible();
  });
});