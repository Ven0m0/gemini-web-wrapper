import { test, expect } from '@playwright/test';
import { PWATestHelpers } from './helpers.js';

test.describe('WebSocket Integration', () => {
  let helpers;

  test.beforeEach(async ({ page }) => {
    helpers = new PWATestHelpers(page);
    await page.goto('/');
    await helpers.waitForCLI();
    
    // Mock WebSocket for testing
    await helpers.mockWebSocketServer();
  });

  test('should handle WebSocket connection commands', async ({ page }) => {
    // Test socket status (disconnected initially)
    await helpers.executeCommand('/socket status');
    await expect(page.locator('.cli-history')).toContainText('No WebSocket connection');
    
    // Test socket connect
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    
    // Wait for connection
    await page.waitForTimeout(200);
    
    // Verify connection message
    await expect(page.locator('.cli-history')).toContainText('WebSocket connected: ws://localhost:8080');
  });

  test('should handle WebSocket server template generation', async ({ page }) => {
    await helpers.executeCommand('/socket server 3000');
    
    // Verify server template is displayed
    await expect(page.locator('.cli-history')).toContainText('WebSocket Server Template:');
    await expect(page.locator('.cli-history')).toContainText('const WebSocket = require');
    await expect(page.locator('.cli-history')).toContainText('port: 3000');
    await expect(page.locator('.cli-history')).toContainText('Save as websocket-server.js');
  });

  test('should handle WebSocket command execution', async ({ page }) => {
    // Connect first
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    await page.waitForTimeout(200);
    
    // Execute command
    await helpers.executeCommand('/socket exec echo "test"');
    await expect(page.locator('.cli-history')).toContainText('Executing: echo "test"');
    
    // Wait for mock response
    await page.waitForTimeout(100);
    
    // Should receive mock server response
    await expect(page.locator('.cli-history')).toContainText('STATUS: Mock server response');
  });

  test('should handle WebSocket message sending', async ({ page }) => {
    // Connect first
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    await page.waitForTimeout(200);
    
    // Send message
    await helpers.executeCommand('/socket send hello world');
    await expect(page.locator('.cli-history')).toContainText('Sent: hello world');
  });

  test('should handle WebSocket disconnection', async ({ page }) => {
    // Connect first
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    await page.waitForTimeout(200);
    
    // Disconnect
    await helpers.executeCommand('/socket disconnect');
    await expect(page.locator('.cli-history')).toContainText('WebSocket disconnected');
    
    // Test status after disconnect
    await helpers.executeCommand('/socket status');
    await expect(page.locator('.cli-history')).toContainText('No WebSocket connection');
  });

  test('should handle WebSocket errors gracefully', async ({ page }) => {
    // Try to execute command without connection
    await helpers.executeCommand('/socket exec ls');
    await expect(page.locator('.cli-history')).toContainText('Not connected to WebSocket server');
    
    // Try to send message without connection
    await helpers.executeCommand('/socket send test');
    await expect(page.locator('.cli-history')).toContainText('Not connected to WebSocket server');
  });

  test('should display WebSocket help information', async ({ page }) => {
    await helpers.executeCommand('/socket');
    
    // Verify help content
    await expect(page.locator('.cli-history')).toContainText('Usage: /socket <command>');
    await expect(page.locator('.cli-history')).toContainText('connect <url>');
    await expect(page.locator('.cli-history')).toContainText('disconnect');
    await expect(page.locator('.cli-history')).toContainText('exec <command>');
    await expect(page.locator('.cli-history')).toContainText('send <message>');
    await expect(page.locator('.cli-history')).toContainText('server [port]');
    await expect(page.locator('.cli-history')).toContainText('clear');
  });

  test('should handle WebSocket file upload command', async ({ page }) => {
    // Connect first
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    await page.waitForTimeout(200);
    
    // Mock file chooser for upload
    page.on('filechooser', async fileChooser => {
      // In real test, we can't actually select files
      // but we can verify the file chooser is triggered
      expect(fileChooser).toBeTruthy();
    });
    
    // Trigger upload command
    await helpers.executeCommand('/upload test.txt');
    
    // Verify file picker is requested
    await expect(page.locator('.cli-history')).toContainText('Opening file picker for upload');
  });

  test('should handle WebSocket file download command', async ({ page }) => {
    // Connect first
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    await page.waitForTimeout(200);
    
    // Request download
    await helpers.executeCommand('/download test.txt');
    
    await expect(page.locator('.cli-history')).toContainText('Requesting download: test.txt');
    await expect(page.locator('.cli-history')).toContainText('Waiting for server response');
  });

  test('should handle WebSocket connection failure', async ({ page }) => {
    // Override mock to simulate connection failure
    await page.addInitScript(() => {
      window.WebSocket = class FailingWebSocket {
        constructor(url) {
          this.url = url;
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Connection failed'));
            }
          }, 100);
        }
        send() {}
        close() {}
      };
    });
    
    await helpers.executeCommand('/socket connect ws://invalid:9999');
    
    // Wait for error
    await page.waitForTimeout(200);
    
    await expect(page.locator('.cli-history')).toContainText('Failed to connect');
  });

  test('should clear WebSocket message history', async ({ page }) => {
    // Connect and generate some messages
    await helpers.executeCommand('/socket connect ws://localhost:8080');
    await page.waitForTimeout(200);
    
    await helpers.executeCommand('/socket send test1');
    await helpers.executeCommand('/socket send test2');
    
    // Clear history
    await helpers.executeCommand('/socket clear');
    await expect(page.locator('.cli-history')).toContainText('WebSocket message history cleared');
  });

  test('should handle invalid WebSocket commands', async ({ page }) => {
    await helpers.executeCommand('/socket invalid');
    
    // Should show help
    await expect(page.locator('.cli-history')).toContainText('Usage: /socket <command>');
  });
});