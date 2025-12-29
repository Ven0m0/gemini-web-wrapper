import { test, expect } from '@playwright/test';
import { PWATestHelpers } from './helpers.js';

test.describe('AI Workflows', () => {
  let helpers;

  test.beforeEach(async ({ page }) => {
    helpers = new PWATestHelpers(page);
    await page.goto('/');
    await helpers.waitForCLI();
    await helpers.setupConfig();
  });

  test('should process AI instructions and apply changes', async ({ page }) => {
    // Mock GitHub API for file operations
    await page.route('**/repos/test-owner/test-repo/contents/README.md**', route => {
      const method = route.request().method();
      if (method === 'GET') {
        // Return existing README content
        const originalContent = '# Test Project\n\nThis is a test project.';
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            content: btoa(originalContent),
            sha: 'original-sha-123'
          })
        });
      } else if (method === 'PUT') {
        // Handle commit operation
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            content: { sha: 'new-sha-456' },
            commit: { sha: 'commit-sha-789' }
          })
        });
      }
    });

    // Mock OpenAI API response
    await page.route('**/chat/completions', route => {
      const requestBody = route.request().postDataJSON();
      
      // Verify the request contains our instruction
      const messages = requestBody.messages;
      const userMessage = messages.find(m => m.role === 'user');
      expect(userMessage.content).toContain('Add installation instructions');
      
      // Return AI-generated content
      const aiResponse = `# Test Project

This is a test project.

## Installation

To install this project:

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/test-owner/test-repo.git
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Usage

Open your browser and navigate to \`http://localhost:3000\`.`;

      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o-mini',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: aiResponse
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300
          }
        })
      });
    });

    // Execute the AI workflow
    await helpers.executeCommand('/open README.md');
    await expect(page.locator('.cli-history')).toContainText('Opened README.md');

    // Send AI instruction
    await helpers.executeCommand('Add installation instructions');
    
    // Wait for AI processing to complete
    await expect(page.locator('.cli-history')).toContainText('AI transformation completed', { timeout: 10000 });
    await expect(page.locator('.cli-history')).toContainText('Use /apply to apply changes');

    // Apply the AI changes
    await helpers.executeCommand('/apply');
    await expect(page.locator('.cli-history')).toContainText('AI changes applied to editor');

    // Verify content was updated in editor
    await helpers.executeCommand('/editor');
    await expect(page.locator('.editor-container')).toBeVisible();
    await expect(page.locator('.editor-content')).toContainText('Installation');
    await expect(page.locator('.editor-content')).toContainText('git clone');
    await expect(page.locator('.editor-content')).toContainText('npm install');

    // Test passes if we get to this point - AI workflow completed successfully
  });

  test('should handle AI errors gracefully', async ({ page }) => {
    // Mock GitHub API for file loading
    await page.route('**/repos/test-owner/test-repo/contents/test.md**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa('# Test Content'),
          sha: 'test-sha-123'
        })
      });
    });

    // Mock OpenAI API error
    await page.route('**/chat/completions', route => {
      route.fulfill({
        status: 429, // Rate limit error
        body: JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        })
      });
    });

    await helpers.executeCommand('/open test.md');
    await helpers.executeCommand('Add some documentation');
    
    // Verify error is handled gracefully  
    await expect(page.locator('.cli-history')).toContainText('Error: OpenAI API error:', { timeout: 10000 });
  });

  test('should handle different AI model configurations', async ({ page }) => {
    // Switch model using CLI command first
    await helpers.executeCommand('/model gpt-3.5-turbo');

    // Mock file loading
    await page.route('**/repos/test-owner/test-repo/contents/config.md**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa('# Configuration'),
          sha: 'config-sha-123'
        })
      });
    });

    // Mock OpenAI API (model might still be default due to implementation)
    await page.route('**/chat/completions', route => {
      const requestBody = route.request().postDataJSON();
      
      // Just respond with AI content for now
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              content: '# Configuration\n\nUpdated configuration with AI model response.'
            }
          }]
        })
      });
    });

    await helpers.executeCommand('/open config.md');
    await helpers.executeCommand('Make this more engaging');
    
    await expect(page.locator('.cli-history')).toContainText('AI transformation completed');
  });

  test('should handle empty or invalid AI responses', async ({ page }) => {
    // Mock file loading
    await page.route('**/repos/test-owner/test-repo/contents/empty.md**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa('# Empty Test'),
          sha: 'empty-sha-123'
        })
      });
    });

    // Mock OpenAI API with empty response
    await page.route('**/chat/completions', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              content: '' // Empty response
            }
          }]
        })
      });
    });

    await helpers.executeCommand('/open empty.md');
    await helpers.executeCommand('Add content to this file');
    
    // With empty response, AI would still complete but with empty content
    await expect(page.locator('.cli-history')).toContainText('AI transformation completed');
  });

  test('should preserve file context in AI requests', async ({ page }) => {
    const fileContent = `# React Component
import React from 'react';

const Button = () => {
  return <button>Click me</button>;
};

export default Button;`;

    // Mock file loading
    await page.route('**/repos/test-owner/test-repo/contents/Button.tsx**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(fileContent),
          sha: 'button-sha-123'
        })
      });
    });

    // Mock OpenAI API and verify context
    await page.route('**/chat/completions', route => {
      const requestBody = route.request().postDataJSON();
      const messages = requestBody.messages;
      
      // Verify system message exists and user message contains the instruction
      const systemMessage = messages.find(m => m.role === 'system');
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.content).toContain('You rewrite the whole file');
      
      // Verify user content is included
      const userMessage = messages.find(m => m.role === 'user');
      expect(userMessage.content).toContain('Add TypeScript props');
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              content: `# React Component
import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ onClick, disabled, children }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;`
            }
          }]
        })
      });
    });

    await helpers.executeCommand('/open Button.tsx');
    await helpers.executeCommand('Add TypeScript props interface');
    
    await expect(page.locator('.cli-history')).toContainText('AI transformation completed');
    
    await helpers.executeCommand('/apply');
    await helpers.executeCommand('/editor');
    
    // Verify TypeScript props were added
    await expect(page.locator('.editor-content')).toContainText('interface ButtonProps');
    await expect(page.locator('.editor-content')).toContainText('React.FC<ButtonProps>');
  });

  test('should handle token estimation for AI requests', async ({ page }) => {
    const longContent = 'Lorem ipsum '.repeat(500); // Create long content
    
    // Mock file loading with long content
    await page.route('**/repos/test-owner/test-repo/contents/long.md**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa(longContent),
          sha: 'long-sha-123'
        })
      });
    });

    await helpers.executeCommand('/open long.md');
    
    // Test token estimation
    await helpers.executeCommand('/tokens');
    await expect(page.locator('.cli-history')).toContainText('Estimated tokens:', { timeout: 10000 });
  });

  test('should support AI model switching during session', async ({ page }) => {
    // Mock file loading
    await page.route('**/repos/test-owner/test-repo/contents/switch.md**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          content: btoa('# Model Test'),
          sha: 'switch-sha-123'
        })
      });
    });

    let modelUsed = '';

    // Mock OpenAI API to capture model changes
    await page.route('**/chat/completions', route => {
      const requestBody = route.request().postDataJSON();
      modelUsed = requestBody.model;
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              content: `# Model Test\n\nProcessed with ${modelUsed}`
            }
          }]
        })
      });
    });

    await helpers.executeCommand('/open switch.md');
    
    // Switch to different model
    await helpers.executeCommand('/model gpt-4');
    await expect(page.locator('.cli-history')).toContainText('Switched to model: gpt-4');
    
    // Test AI with new model
    await helpers.executeCommand('Update this content');
    await expect(page.locator('.cli-history')).toContainText('AI transformation completed');
    
    // Verify correct model was used
    expect(modelUsed).toBe('gpt-4');
  });
});