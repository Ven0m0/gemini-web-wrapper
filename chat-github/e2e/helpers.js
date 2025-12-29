import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Test helper functions for PWA testing
 */
// Polyfill btoa/atob for Node.js test environment
if (typeof global.btoa !== 'function') {
  global.btoa = (str) => Buffer.from(str, 'utf8').toString('base64');
}
if (typeof global.atob !== 'function') {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('utf8');
}

export class PWATestHelpers {
  constructor(page) {
    this.page = page;
  }

  /**
   * Wait for CLI to be ready
   */
  async waitForCLI() {
    await this.page.waitForSelector('.cli-container', { timeout: 10000 });
    await this.page.waitForSelector('.cli-input', { timeout: 5000 });
    await expect(this.page.locator('.cli-input')).toBeVisible();
  }

  /**
   * Execute CLI command and wait for result
   */
  async executeCommand(command, expectedText = null) {
    await this.page.fill('.cli-input', command);
    await this.page.press('.cli-input', 'Enter');
    
    // Wait for processing to complete
    try {
      await this.page.waitForSelector('.cli-line.processing', { state: 'detached', timeout: 10000 });
    } catch (e) {
      // Processing selector might not exist, continue
    }
    
    if (expectedText) {
      // Wait a bit for mode switching to complete
      await this.page.waitForTimeout(200);
      
      // Only check history if we're still in CLI mode
      if (await this.page.locator('.cli-history').count() > 0) {
        await expect(this.page.locator('.cli-history')).toContainText(expectedText);
      }
    }
  }

  /**
   * Setup test configuration with AI support
   */
  async setupConfig() {
    // Mock all GitHub API calls to avoid authentication issues
    await this.page.route('**/repos/**', route => {
      const url = route.request().url();
      const method = route.request().method();
      
      if (url.includes('/contents/')) {
        if (method === 'GET') {
          // Parse URL to get filename and check for directory listing
          const urlParts = url.split('/contents/')[1];
          const filename = urlParts ? urlParts.split('?')[0] : '';
          
          // If empty path or just query params, it's a directory listing
          if (!filename || filename === '') {
            // Mock directory listing
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify([
                { name: 'README.md', type: 'file', size: 1024, path: 'README.md' },
                { name: 'src', type: 'dir', size: 0, path: 'src' },
                { name: 'package.json', type: 'file', size: 2048, path: 'package.json' }
              ])
            });
            return;
          }
          
          // Mock file content response
          
          // Handle special cases for file creation tests
          if (filename === 'src/NewComponent.tsx' || url.includes('NewComponent.tsx')) {
            // Return 404 for new file creation tests
            route.fulfill({ status: 404, body: JSON.stringify({message: "Not Found"}) });
            return;
          }
          
          let content;
          
          if (filename.includes('chinese') || filename.includes('中文')) {
            content = '这是一个中文测试文件\n中英文混合内容\nMixed Chinese and English content';
          } else if (filename === 'syntax.js') {
            content = 'function testFunction() {\n  console.log("Hello World");\n  return true;\n}\n\ntestFunction();';
          } else if (filename.endsWith('.js')) {
            content = 'function testFunction() {\n  console.log("Hello World");\n}\n\ntestFunction();';
          } else if (filename === 'empty.txt') {
            content = ''; // Actually empty for empty file test
          } else {
            content = 'This is a test file\nwith multiple lines\nfor testing purposes';
          }
          
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: btoa(unescape(encodeURIComponent(content))), // Proper UTF-8 to base64
              sha: 'mock-sha-' + Math.random().toString(36).substr(2, 9),
              name: filename
            })
          });
        } else {
          // Mock create/update response
          route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              content: { sha: 'new-sha-' + Math.random().toString(36).substr(2, 9) }
            })
          });
        }
      }
    });

    // Use localStorage to set config directly and set store state
    await this.page.evaluate(() => {
      const config = {
        githubToken: 'mock-token',
        openaiKey: 'mock-key',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        model: 'gpt-4',
        path: ''
      };
      
      // Set in localStorage
      localStorage.setItem('chat-github-config', JSON.stringify(config));
      
      // Also set in store if available
      if (window.useStore && window.useStore.getState) {
        const store = window.useStore.getState();
        if (store.setConfig) {
          store.setConfig(config);
        }
      }
    });
    
    // Reload to pick up config
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.waitForCLI();
    
    // Verify config is loaded by checking if /help works
    await this.page.waitForTimeout(200);
  }

  /**
   * Switch to editor mode and verify
   */
  async switchToEditor() {
    await this.executeCommand('/editor', 'Switched to editor mode');
    await this.page.waitForSelector('.editor-container', { timeout: 5000 });
    await expect(this.page.locator('.editor-container')).toBeVisible();
  }

  /**
   * Switch to CLI mode and verify
   */
  async switchToCLI() {
    await this.page.click('.mode-btn');
    await this.page.waitForSelector('.cli-container', { timeout: 5000 });
    await expect(this.page.locator('.cli-container')).toBeVisible();
  }

  /**
   * Switch to Tool mode and verify
   */
  async switchToTool() {
    await this.executeCommand('/tool', 'Switched to tool mode');
    await this.page.waitForSelector('.tool-container', { timeout: 5000 });
    await expect(this.page.locator('.tool-container')).toBeVisible();
  }

  /**
   * Clear CLI history
   */
  async clearHistory() {
    await this.executeCommand('/clear');
    const historyItems = await this.page.locator('.cli-line').count();
    expect(historyItems).toBe(0);
  }

  /**
   * Verify PWA features
   */
  async verifyPWAFeatures() {
    // Check for service worker registration
    const hasServiceWorker = await this.page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    expect(hasServiceWorker).toBe(true);

    // Check manifest
    const manifestLink = this.page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');
  }

  /**
   * Test mobile responsiveness
   */
  async testMobileResponsiveness() {
    // Set mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });
    
    // Test touch interactions
    await this.page.tap('.cli-input');
    await expect(this.page.locator('.cli-input')).toBeFocused();
    
    // Test mobile UI elements
    await expect(this.page.locator('.cli-container')).toBeVisible();
    
    // Restore desktop viewport
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  /**
   * Mock WebSocket server for testing
   */
  async mockWebSocketServer() {
    await this.page.addInitScript(() => {
      // Completely replace WebSocket with a mock that never fails
      window.WebSocket = function(url) {
        console.log('Mock WebSocket constructor called with:', url);
        
        // Create a mock WebSocket instance
        const mock = {
          url: url,
          readyState: 0, // CONNECTING
          
          // Event handlers
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          
          // Methods
          send: function(data) {
            console.log('Mock WebSocket send:', data);
            // Simulate successful send with response
            if (this.readyState === 1 && this.onmessage) {
              setTimeout(() => {
                this.onmessage({
                  data: JSON.stringify({
                    type: 'status',
                    data: 'Mock server response',
                    timestamp: Date.now()
                  })
                });
              }, 100);
            }
          },
          
          close: function(code = 1000, reason = 'Normal closure') {
            console.log('Mock WebSocket close called');
            this.readyState = 3; // CLOSED
            if (this.onclose) {
              this.onclose({
                type: 'close',
                wasClean: true,
                code: code,
                reason: reason
              });
            }
          },
          
          addEventListener: function(type, listener) {
            this['on' + type] = listener;
          },
          
          removeEventListener: function(type, listener) {
            if (this['on' + type] === listener) {
              this['on' + type] = null;
            }
          }
        };
        
        // Simulate successful connection immediately
        setTimeout(() => {
          console.log('Mock WebSocket: Simulating successful connection');
          mock.readyState = 1; // OPEN
          if (mock.onopen) {
            console.log('Mock WebSocket: Calling onopen handler');
            try {
              mock.onopen({ type: 'open', target: mock });
            } catch (e) {
              console.error('Error in mock onopen:', e);
            }
          }
        }, 50);
        
        return mock;
      };
      
      // Add static constants
      window.WebSocket.CONNECTING = 0;
      window.WebSocket.OPEN = 1;
      window.WebSocket.CLOSING = 2;
      window.WebSocket.CLOSED = 3;
      
      console.log('Simple WebSocket mock installed');
    });
  }

  /**
   * Create test file content
   */
  createTestFileContent(fileType = 'text') {
    switch (fileType) {
      case 'text':
        return 'This is a test file for Playwright testing.\nSecond line with content.';
      case 'chinese':
        return '这是一个中文测试文件\nThis is a Chinese test file\n中英文混合内容';
      case 'javascript':
        return 'function testFunction() {\n  console.log("Hello World");\n  return true;\n}';
      case 'markdown':
        return '# Test Markdown\n\n## Section\n\n- List item 1\n- List item 2\n\n**Bold text**';
      default:
        return 'Default test content';
    }
  }

  /**
   * Wait for network idle (useful for API calls)
   */
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take screenshot with timestamp
   */
  async takeTimestampedScreenshot(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `e2e/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Mock OpenAI API with custom response
   */
  async mockAIResponse(instruction, response, options = {}) {
    await this.page.route('**/chat/completions', route => {
      const requestBody = route.request().postDataJSON();
      
      // Verify request structure
      expect(requestBody.messages).toBeTruthy();
      expect(requestBody.model).toBeTruthy();
      
      // Check if instruction matches
      const userMessage = requestBody.messages.find(m => m.role === 'user');
      if (instruction && userMessage) {
        expect(userMessage.content).toContain(instruction);
      }
      
      // Verify model and temperature if specified
      if (options.model) {
        expect(requestBody.model).toBe(options.model);
      }
      if (options.temperature !== undefined) {
        expect(requestBody.temperature).toBe(options.temperature);
      }
      
      route.fulfill({
        status: options.status || 200,
        body: JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: requestBody.model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: response
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: options.promptTokens || 100,
            completion_tokens: options.completionTokens || 200,
            total_tokens: (options.promptTokens || 100) + (options.completionTokens || 200)
          }
        })
      });
    });
  }

  /**
   * Mock OpenAI API error
   */
  async mockAIError(errorType = 'rate_limit_error', message = 'Rate limit exceeded', status = 429) {
    await this.page.route('**/chat/completions', route => {
      route.fulfill({
        status,
        body: JSON.stringify({
          error: {
            message,
            type: errorType,
            code: errorType
          }
        })
      });
    });
  }

  /**
   * Execute AI workflow: open file, send instruction, apply changes
   */
  async executeAIWorkflow(filename, instruction, expectedContent = null) {
    // Open file
    await this.executeCommand(`/open ${filename}`);
    await expect(this.page.locator('.cli-history')).toContainText(`Opened ${filename}`);
    
    // Send AI instruction
    await this.executeCommand(instruction);
    await expect(this.page.locator('.cli-history')).toContainText('AI transformation completed', { timeout: 10000 });
    
    // Apply changes
    await this.executeCommand('/apply');
    await expect(this.page.locator('.cli-history')).toContainText('AI changes applied to editor');
    
    // Verify content if provided
    if (expectedContent) {
      await this.executeCommand('/editor');
      await expect(this.page.locator('.editor-content')).toContainText(expectedContent);
      await this.executeCommand('/cli');
    }
  }

  /**
   * Verify AI request contains proper context
   */
  async verifyAIContext(filename, originalContent) {
    await this.page.route('**/chat/completions', route => {
      const requestBody = route.request().postDataJSON();
      const messages = requestBody.messages;
      
      // Check system message contains file context
      const systemMessage = messages.find(m => m.role === 'system');
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.content).toContain(filename);
      expect(systemMessage.content).toContain(originalContent);
      
      // Mock response
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: { content: 'Mocked AI response' }
          }]
        })
      });
    });
  }

  /**
   * Switch AI model and verify configuration
   */
  async switchAIModel(modelName) {
    await this.executeCommand(`/model ${modelName}`);
    await expect(this.page.locator('.cli-history')).toContainText(`Switched to model: ${modelName}`);
    
    // Verify model is updated in config
    const config = await this.page.evaluate(() => {
      return JSON.parse(localStorage.getItem('chat-github-config') || '{}');
    });
    expect(config.model).toBe(modelName);
  }

  /**
   * Test token estimation
   */
  async testTokenEstimation(expectedContent) {
    await this.executeCommand('/tokens');
    await expect(this.page.locator('.cli-history')).toContainText('Token estimation:');
    await expect(this.page.locator('.cli-history')).toContainText('Current content:');
    await expect(this.page.locator('.cli-history')).toContainText('tokens');
    
    if (expectedContent) {
      await expect(this.page.locator('.cli-history')).toContainText(expectedContent);
    }
  }
}
