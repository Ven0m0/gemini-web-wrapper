# AI Workflows Testing Guide

This document describes the AI functionality tests for the Chat GitHub PWA.

## Test Files

- **`ai-workflows.spec.js`** - Main AI functionality tests
- **`helpers.js`** - Updated with AI-specific helper methods
- **`test-config.json`** - Test configuration including AI settings

## Running AI Tests

### Run All AI Tests
```bash
npm run test:ai
```

### Run Specific AI Test  
```bash
npx playwright test ai-workflows.spec.js -g "should process AI instructions"
```

### Debug AI Tests
```bash
npx playwright test ai-workflows.spec.js --debug
```

### Run with UI Mode
```bash
npx playwright test ai-workflows.spec.js --ui
```

## Test Cases Overview

### 1. **Basic AI Workflow** (`should process AI instructions and apply changes`)
**Purpose**: Tests the complete AI transformation workflow
- ✅ Loads file content from GitHub API
- ✅ Sends AI instruction to OpenAI API  
- ✅ Applies AI-generated changes to editor
- ✅ Shows diff of changes
- ✅ Commits changes back to GitHub

**Flow**:
```bash
/open README.md                     # Load file
Add installation instructions       # AI instruction  
/apply                             # Apply AI changes
/diff                              # Show differences
/commit "docs: add installation"   # Save changes
```

### 2. **AI Error Handling** (`should handle AI errors gracefully`)
**Purpose**: Tests error handling for AI API failures
- ✅ Handles rate limiting errors (429)
- ✅ Displays user-friendly error messages
- ✅ Maintains app stability after errors

### 3. **Model Configuration** (`should handle different AI model configurations`)
**Purpose**: Tests AI model and parameter management
- ✅ Supports different OpenAI models (gpt-4, gpt-3.5-turbo)
- ✅ Configures temperature and other parameters
- ✅ Verifies correct model is used in API requests

### 4. **Response Validation** (`should handle empty or invalid AI responses`)
**Purpose**: Tests edge cases for AI responses
- ✅ Handles empty AI responses
- ✅ Validates response structure
- ✅ Shows appropriate user feedback

### 5. **Context Preservation** (`should preserve file context in AI requests`)
**Purpose**: Tests that file context is properly sent to AI
- ✅ Includes file content in AI requests
- ✅ Provides file type and name context
- ✅ Maintains conversation context

### 6. **Token Management** (`should handle token estimation for AI requests`)
**Purpose**: Tests token counting and estimation
- ✅ Estimates token usage for content
- ✅ Provides token count feedback
- ✅ Handles large content efficiently

### 7. **Model Switching** (`should support AI model switching during session`)
**Purpose**: Tests dynamic model configuration
- ✅ Switches AI models mid-session
- ✅ Updates configuration persistently  
- ✅ Uses new model for subsequent requests

## API Mocking Strategy

### OpenAI API Mocking
```javascript
// Mock successful AI response
await helpers.mockAIResponse(
  'Add installation instructions',  // Expected instruction
  '# Updated content...',           // AI response
  { model: 'gpt-4', temperature: 0.3 } // Options
);

// Mock API error
await helpers.mockAIError('rate_limit_error', 'Rate limit exceeded', 429);
```

### GitHub API Mocking
```javascript
// Mock file loading
await page.route('**/repos/test-owner/test-repo/contents/README.md**', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({
      content: btoa('# Original content'),
      sha: 'original-sha-123'
    })
  });
});
```

## Helper Methods

### AI-Specific Helpers
```javascript
// Execute complete AI workflow
await helpers.executeAIWorkflow('README.md', 'Add docs', 'Installation');

// Mock AI response with validation
await helpers.mockAIResponse(instruction, response, options);

// Test error scenarios
await helpers.mockAIError(errorType, message, status);

// Switch AI models
await helpers.switchAIModel('gpt-4');

// Test token estimation
await helpers.testTokenEstimation('Expected content');
```

## Test Configuration

### AI Settings in `test-config.json`
```json
{
  "openaiKey": "sk-test_key_for_playwright",
  "model": "gpt-4o-mini", 
  "temperature": 0.3
}
```

### Helper Configuration in `helpers.js`
```javascript
const config = {
  githubToken: 'mock-token',
  openaiKey: 'mock-key',
  model: 'gpt-4',
  temperature: 0.3
};
```

## Expected Behaviors

### Successful AI Request
1. **Request Validation**: 
   - Contains proper OpenAI API format
   - Includes file content as context
   - Uses configured model and parameters

2. **Response Processing**:
   - Parses AI response content
   - Shows "AI transformation completed" message
   - Makes content available for `/apply` command

3. **Content Application**:
   - Replaces editor content with AI response
   - Shows "Changes applied to editor" message
   - Marks file as dirty for commit

### Error Handling
1. **API Errors**:
   - Shows specific error messages
   - Maintains application stability
   - Allows retry or alternative actions

2. **Invalid Responses**:
   - Handles empty responses gracefully
   - Validates response structure
   - Provides user feedback

## Test Data

### Sample AI Responses
```javascript
const installationDocs = `# Project Name

## Installation  

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/user/repo.git
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\``;
```

### Sample Instructions
- "Add installation instructions"
- "Add TypeScript props interface"
- "Make this more engaging"
- "Update this content"
- "Add error handling to this function"

## Debugging Tips

### View Network Requests
```bash
# Run with network debugging
PWDEBUG=1 npx playwright test ai-workflows.spec.js
```

### Check API Calls
The tests verify:
- OpenAI API request structure
- GitHub API file operations
- Proper error handling
- Model configuration usage

### Common Issues
1. **Route not matching**: Check URL patterns in `page.route()`
2. **Timeout errors**: Increase timeout for AI operations  
3. **Missing context**: Verify file content is included in requests
4. **Model mismatch**: Ensure test uses correct model name

## Test Coverage

✅ **AI API Integration** - OpenAI chat completions API  
✅ **Error Handling** - Rate limits, invalid responses, network errors  
✅ **Model Management** - Model switching, parameter configuration  
✅ **Context Handling** - File content, conversation context  
✅ **Token Management** - Token counting, usage estimation  
✅ **Content Application** - Editor integration, diff display  
✅ **Commit Integration** - GitHub API file updates  

The test suite provides comprehensive coverage of AI functionality while using proper mocking to avoid external API dependencies during testing.