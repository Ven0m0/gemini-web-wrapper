import { test, expect } from '@playwright/test';
import { PWATestHelpers } from './helpers.js';

test.describe('File Operations', () => {
  let helpers;

  test.beforeEach(async ({ page }) => {
    helpers = new PWATestHelpers(page);
    await page.goto('/');
    await helpers.waitForCLI();
    
    // Setup configuration for file operations
    await helpers.setupConfig();
  });

  test('should handle file listing commands', async ({ page }) => {
    await helpers.executeCommand('/ls');
    
    await expect(page.locator('.cli-history')).toContainText('Contents of root:');
    await expect(page.locator('.cli-history')).toContainText('📁 src');
    await expect(page.locator('.cli-history')).toContainText('📄 README.md');
    await expect(page.locator('.cli-history')).toContainText('📄 package.json');
  });

  test('should handle file preview with cat command', async ({ page }) => {
    const mockContent = helpers.createTestFileContent('text');
    
    await page.route('**/repos/*/contents/test.txt**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(mockContent),
          sha: 'mock-sha-123'
        })
      });
    });

    await helpers.executeCommand('/cat test.txt');
    
    await expect(page.locator('.cli-history')).toContainText('Content of test.txt:');
    await expect(page.locator('.cli-history')).toContainText('This is a test file');
  });

  test('should create new file with template', async ({ page }) => {
    // Override the global route for this specific file
    await page.route('**/repos/test-owner/test-repo/contents/src/NewComponent.tsx**', route => {
      const method = route.request().method();
      if (method === 'GET') {
        // Return 404 to indicate file doesn't exist
        route.fulfill({ status: 404, body: JSON.stringify({message: "Not Found"}) });
      } else {
        // POST/PUT - successful creation
        route.fulfill({
          status: 201,
          body: JSON.stringify({
            content: { sha: 'new-file-sha-123' }
          })
        });
      }
    });

    await helpers.executeCommand('/new src/NewComponent.tsx');
    
    await expect(page.locator('.cli-history')).toContainText('Created new file: src/NewComponent.tsx');
    
    // Switch to editor to verify template
    await helpers.switchToEditor();
    await expect(page.locator('.cm-editor')).toContainText('React');
    await expect(page.locator('.cm-editor')).toContainText('Component');
  });

  test('should handle file open and editing workflow', async ({ page }) => {
    const mockContent = helpers.createTestFileContent('javascript');
    
    await page.route('**/repos/*/contents/test.js**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(mockContent),
          sha: 'existing-sha-456'
        })
      });
    });

    // Open file
    await helpers.executeCommand('/open test.js');
    await expect(page.locator('.cli-history')).toContainText('Opened test.js');
    
    // Switch to editor
    await helpers.switchToEditor();
    
    // Verify content is loaded
    await expect(page.locator('.cm-editor')).toContainText('function testFunction');
    
    // Verify status bar shows file info
    await expect(page.locator('.status-left')).toContainText('test.js');
  });

  test('should handle file save to local downloads', async ({ page }) => {
    const mockContent = helpers.createTestFileContent('text');
    
    await page.route('**/repos/*/contents/test.txt**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(mockContent),
          sha: 'test-sha'
        })
      });
    });

    // Open file first
    await helpers.executeCommand('/open test.txt');
    
    // Test save command
    const downloadPromise = page.waitForEvent('download');
    await helpers.executeCommand('/save');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('test.txt');
    
    await expect(page.locator('.cli-history')).toContainText('File saved locally');
    await expect(page.locator('.cli-history')).toContainText('Check your Downloads folder');
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    // Test 404 file not found
    // Override global route with more specific route
    await page.unroute('**/repos/**');
    await page.route('**/repos/test-owner/test-repo/contents/nonexistent.txt**', route => {
      route.fulfill({ 
        status: 404, 
        body: JSON.stringify({ message: "Not Found" })
      });
    });

    await helpers.executeCommand('/open nonexistent.txt');
    await expect(page.locator('.cli-history')).toContainText('Error: Failed to open file');
    
    // Test invalid command usage
    await helpers.executeCommand('/open');
    await expect(page.locator('.cli-history')).toContainText('Usage: /open <path>');
  });

  test('should handle large file truncation in cat command', async ({ page }) => {
    // Create large content (> 50 lines)
    const largeContent = Array.from({ length: 60 }, (_, i) => `Line ${i + 1} content here`).join('\n');
    
    // Override global route for this specific large file test
    await page.unroute('**/repos/**');
    await page.route('**/repos/test-owner/test-repo/contents/large.txt**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(unescape(encodeURIComponent(largeContent))), // Proper UTF-8 encoding
          sha: 'large-file-sha-' + Math.random().toString(36).substr(2, 9),
          name: 'large.txt'
        })
      });
    });

    await helpers.executeCommand('/cat large.txt');
    
    await expect(page.locator('.cli-history')).toContainText('... (showing first 50 lines of');
    await expect(page.locator('.cli-history')).toContainText('Use /open to load the full file for editing');
  });
});