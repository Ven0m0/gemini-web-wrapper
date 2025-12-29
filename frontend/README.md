# Phone AI + GitHub 📱🤖  
[![CI - Playwright Tests](https://github.com/WangChengYeh/Chat_github/actions/workflows/ci-tests.yml/badge.svg)](https://github.com/WangChengYeh/Chat_github/actions/workflows/ci-tests.yml)
[![Deploy PWA to GitHub Pages](https://github.com/WangChengYeh/Chat_github/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/WangChengYeh/Chat_github/actions/workflows/deploy-pages.yml)
**Mobile-First Dual Fullscreen: AI CLI & Text Editor with Chinese Support**

A minimal, phone-friendly React PWA for editing GitHub repository files using AI assistance. Designed for SMALL SCREENS with only two main views—AI CLI (chat/commands) and Fullscreen Text Editor (viewer + edit + diff toggle). Fully supports Chinese text editing and AI instructions.

## 🚀 **[Launch PWA →](https://wangchengyeh.github.io/Chat_github/)**

### **Quick Start:**
1. **Launch**: Click the link above to open the app
2. **Setup**: Type `/config` to configure your GitHub token and OpenAI API key  
3. **Edit**: Use `/open filename` to load files and start AI-assisted editing
4. **Install**: Look for "Add to Home Screen" (mobile) or install icon (desktop)

---

## ✨ **Key Features**

### 🎯 **Core Capabilities**
- **100% Client-Side**: No server required, tokens stay local
- **PWA Ready**: Installable as native app with offline capabilities
- **Mobile-Optimized**: Touch-friendly interface for small screens
- **Command-Driven**: Fast `/command` syntax for power users
- **AI-Powered**: Transform files with natural language instructions
- **Real-Time Sync**: Direct GitHub API integration for immediate commits

### 🌏 **Chinese Language Support**
- **Full CJK Support**: Traditional & Simplified Chinese text rendering
- **Chinese Fonts**: PingFang SC, Hiragino Sans GB, Microsoft YaHei
- **Bilingual Interface**: Chinese + English prompts and help text
- **IME Compatible**: Proper input method support for Chinese typing
- **AI Instructions**: Give commands in Chinese: "添加中文註解到這個函數"

### 🔧 **Technical Features**
- **Syntax Highlighting**: JavaScript, TypeScript, Markdown, JSON
- **File Management**: Create, browse, and preview files with `/new`, `/ls`, `/cat`
- **WebSocket File Transfer**: Real-time file exchange between devices via WebSocket
- **Smart Templates**: Auto-generated boilerplate for common file types
- **Binary File Support**: Automatic base64 encoding for images and documents
- **WebSocket Console**: Real-time command execution via WebSocket servers
- **Cross-Device Sync**: Share files between phone, tablet, and desktop via WebSocket
- **Diff Viewer**: Visual comparison with Original → Modified → Diff modes
- **Live Preview**: Real-time file editing with CodeMirror
- **Smart Commits**: Automated git operations with proper SHA handling
- **Token Security**: Optional localStorage with clear privacy controls

---

## 🏗️ **Architecture & Design**

### **Three-Mode Interface**
| Mode | Purpose | Features |
|------|---------|----------|
| **CLI Mode** | AI interaction & commands | Scrollable history, command parsing, AI responses |
| **Editor Mode** | File editing & review | Syntax highlighting, diff view, status bar |
| **Tool Mode** | File upload/download UI | Visual interface between user |

### **Core Principles**
| Principle | Implementation |
|-----------|----------------|
| **Mobile First** | Single-surface interactions, touch-optimized UI |
| **Command Driven** | `/command` syntax for all operations |
| **Full Replacement** | AI returns complete updated files (no merging) |
| **Stateless Backend** | Pure GitHub + OpenAI APIs, no proprietary server |
| **Privacy Focused** | Local token storage, client-side processing |

### **Data Flow**
```
1. /open file.md → GitHub API → Load content into editor
2. "Add comments" → OpenAI API → Generate updated content  
3. /apply → Replace editor content → Mark as dirty
4. /commit "msg" → GitHub API → Save with new SHA
```

---

## 💻 **Command Reference**

### **File Operations**
| Command | Description | Example |
|---------|-------------|---------|
| `/open <path>` | Load file from GitHub | `/open src/App.tsx` |
| `/new <path>` | Create new file with template | `/new src/NewComponent.tsx` |
| `/ls [path]` | List files in directory | `/ls src/` |
| `/cat <path>` | Show file contents | `/cat package.json` |
| `/upload <filename>` | Upload file via WebSocket | `/upload logo.png` |
| `/download <filename>` | Download file via WebSocket | `/download data.json` |
| `/socket <cmd>` | WebSocket console operations | `/socket connect ws://localhost:8080` |
| `/save` | Save current file to local Downloads | `/save` |
| `/revert` | Restore to original content | `/revert` |

### **AI Operations**
| Command | Description | Example |
|---------|-------------|---------|
| `plain text` | AI instruction (no prefix) | `Add error handling to this function` |
| `/apply` | Apply AI changes to editor | `/apply` |
| `/ai <instruction>` | Explicit AI command | `/ai Refactor using async/await` |

### **Git Operations**
| Command | Description | Example |
|---------|-------------|---------|
| `/commit "message"` | Commit current content | `/commit "feat: add validation"` |
| `/diff` | Show differences | `/diff` |
| `/branch <name>` | Switch branch | `/branch feature/new-ui` |

### **System Commands**
| Command | Description | Example |
|---------|-------------|---------|
| `/config` | Open settings overlay | `/config` |
| `/help` | Show all commands | `/help` |
| `/editor` | Switch to editor mode | `/editor` |
| `/tool [upload\|download]` | Switch to file transfer tools | `/tool upload` |
| `/cli` | Switch to CLI mode | `/cli` |
| `/clear` | Clear command history | `/clear` |
| `/tokens` | Estimate token usage | `/tokens` |

### **WebSocket Console**
| Command | Description | Example |
|---------|-------------|---------|
| `/socket connect <url>` | Connect to WebSocket server | `/socket connect ws://localhost:8080` |
| `/socket exec <cmd>` | Execute command on remote server | `/socket exec npm test` |
| `/socket send <msg>` | Send message to stdin | `/socket send hello world` |
| `/socket status` | Show connection status | `/socket status` |
| `/socket server [port]` | Show server template code | `/socket server 3000` |
| `/socket disconnect` | Disconnect from server | `/socket disconnect` |

---

## 🚀 **Deployment & Installation**

### **Web Access**
- **Live URL**: https://wangchengyeh.github.io/Chat_github/
- **GitHub Pages**: Auto-deployed from main branch
- **HTTPS Required**: For PWA and clipboard features

### **PWA Installation**

#### **Mobile (iOS Safari)**
1. Visit https://wangchengyeh.github.io/Chat_github/
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Edit name if desired, then tap **"Add"**
5. App icon appears on home screen
6. Launch from home screen for full standalone experience

#### **Mobile (Android Chrome)**
1. Visit https://wangchengyeh.github.io/Chat_github/
2. Tap the browser menu (three dots)
3. Select **"Add to Home screen"** or look for install banner
4. Tap **"Install"** when prompted
5. App installs like a native app
6. Launch from app drawer or home screen

#### **Desktop (Chrome/Edge/Safari)**
1. Visit https://wangchengyeh.github.io/Chat_github/
2. Look for install icon (⊕ or download icon) in address bar
3. Click the install icon
4. Click **"Install Chat GitHub"** in the popup
5. App opens in dedicated window (no browser UI)
6. Access from Start menu/Applications folder

#### **PWA Features After Installation**
- **Offline Access**: Works without internet connection
- **App-like Experience**: No browser address bar or tabs
- **Home Screen Icon**: Quick access like native apps  
- **Push Notifications**: (Future feature)
- **Background Sync**: (Future feature)
- **File System Access**: Direct file uploads/downloads

### **Self-Hosting**
```bash
git clone https://github.com/WangChengYeh/Chat_github.git
cd Chat_github
npm install
npm run build
# Deploy dist/ folder to your hosting provider
```

### **PWA Configuration for GitHub Pages**

#### **1. Web App Manifest Setup**
Ensure your `manifest.webmanifest` includes proper GitHub Pages paths:

```json
{
  "name": "Chat GitHub - Mobile AI Editor",
  "short_name": "Chat GitHub",
  "description": "AI-powered mobile code editor for GitHub",
  "start_url": "/Chat_github/",
  "scope": "/Chat_github/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#0969da",
  "icons": [
    {
      "src": "/Chat_github/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/Chat_github/icon-512.png", 
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### **2. Service Worker Configuration**
Configure your service worker with correct GitHub Pages paths:

```javascript
// sw.js - Service Worker for GitHub Pages PWA
const CACHE_NAME = 'chat-github-v1.0.0';
const REPO_PATH = '/Chat_github';

// Files to cache for offline functionality
const urlsToCache = [
  `${REPO_PATH}/`,
  `${REPO_PATH}/index.html`,
  `${REPO_PATH}/assets/index.js`,
  `${REPO_PATH}/assets/index.css`,
  `${REPO_PATH}/manifest.webmanifest`,
  `${REPO_PATH}/icon-192.png`,
  `${REPO_PATH}/icon-512.png`
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
```

#### **3. HTML Configuration**
Add these tags to your `index.html` `<head>`:

```html
<!-- PWA Manifest -->
<link rel="manifest" href="/Chat_github/manifest.webmanifest">

<!-- Canonical URL for GitHub Pages -->
<link rel="canonical" href="https://wangchengyeh.github.io/Chat_github/">

<!-- Apple PWA Support -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Chat GitHub">
<link rel="apple-touch-icon" href="/Chat_github/icon-192.png">

<!-- Service Worker Registration -->
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/Chat_github/sw.js', {
        scope: '/Chat_github/'
      }).then((registration) => {
        console.log('SW registered: ', registration);
      }).catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
    });
  }
</script>
```

#### **4. GitHub Pages Deployment Requirements**
- **HTTPS**: GitHub Pages provides HTTPS by default (required for PWA)
- **Path Configuration**: All URLs must include repository name (`/Chat_github/`)
- **Base URL**: Set `base: '/Chat_github/'` in `vite.config.ts`
- **Asset Paths**: Use relative paths or full repository paths
- **Cache Version**: Update `CACHE_NAME` when deploying new versions

#### **5. Build Configuration**
Update your `vite.config.ts` for GitHub Pages:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
      },
      manifest: {
        name: 'Chat GitHub - Mobile AI Editor',
        short_name: 'Chat GitHub',
        start_url: '/Chat_github/',
        scope: '/Chat_github/',
        display: 'standalone'
      }
    })
  ],
  base: '/Chat_github/', // Critical for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
```

#### **6. GitHub Pages PWA Deployment Workflow**

Follow these steps to deploy your PWA to GitHub Pages:

##### **Step 1: Repository Setup**
```bash
# 1. Enable GitHub Pages in repository settings
# Settings → Pages → Source: Deploy from a branch → main branch

# 2. Ensure proper file structure
/
├── index.html              # Main HTML file
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker
├── icon-192.png           # PWA icon (192x192)
├── icon-512.png           # PWA icon (512x512)
└── assets/                # Built assets directory
```

##### **Step 2: Build with Correct Paths**
```bash
# Build with GitHub Pages base path
npm run build

# Verify manifest paths in dist/
cat dist/manifest.webmanifest  # Should show /Chat_github/ paths
```

##### **Step 3: Deploy and Test**
```bash
# Push to main branch — GitHub Actions will build and deploy dist/ to Pages
git push origin main

# Test PWA features:
# 1. Visit https://username.github.io/repository/
# 2. Check browser DevTools → Application → Manifest
# 3. Verify Service Worker is registered and active
# 4. Test offline functionality (disconnect network)
# 5. Look for install prompt on mobile/desktop
```

##### **Step 4: PWA Validation Checklist**
- [ ] ✅ Manifest loads correctly (no 404 errors)
- [ ] ✅ Service worker registers and caches resources
- [ ] ✅ App works offline (shows cached content)
- [ ] ✅ Install prompt appears on supported browsers
- [ ] ✅ Icons display correctly in install prompt
- [ ] ✅ App launches in standalone mode when installed
- [ ] ✅ All paths use correct repository prefix
- [ ] ✅ HTTPS certificate is valid (GitHub Pages default)

##### **Step 5: Troubleshooting Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 on manifest.webmanifest | Wrong path in HTML | Use `/repository-name/manifest.webmanifest` |
| Service worker not registering | Incorrect scope/path | Set scope to `/repository-name/` |
| Install prompt not showing | Missing manifest properties | Add `start_url`, `display: "standalone"` |
| Icons not loading | Wrong icon paths | Use full GitHub Pages paths |
| Offline doesn't work | Cache paths mismatch | Update `urlsToCache` in service worker |
| App reloads instead of staying in standalone | Wrong `scope` in manifest | Ensure scope matches start_url path |

##### **Step 6: GitHub Actions Automation (Optional)**
Create `.github/workflows/deploy-pwa.yml`:

```yaml
name: Deploy PWA to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build PWA
        run: npm run build
        
      - name: Setup Pages
        uses: actions/configure-pages@v3
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: './dist'
          
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

---

## 🔐 **Security & Configuration**

### **Required Tokens**
| Token Type | Permissions | Usage |
|------------|-------------|-------|
| **GitHub PAT** | `contents:write` | Read/write repository files |
| **OpenAI API** | Standard access | AI text transformations |

### **Privacy Controls**
- **Memory Only**: Tokens stored in RAM by default
- **Optional Persistence**: User-controlled localStorage saving
- **No Server**: All processing happens in your browser
- **Token Scoping**: Use fine-grained GitHub tokens when possible

### **Configuration Fields**
```javascript
{
  githubToken: "ghp_...",     // GitHub Personal Access Token
  openaiKey: "sk-...",        // OpenAI API Key  
  owner: "username",          // GitHub username/org
  repo: "repository",         // Repository name
  branch: "main",             // Target branch
  model: "gpt-4o-mini",       // AI model selection
  temperature: 0.3            // AI creativity (0-2)
}
```

---

## 🛠️ **Development**

### **Tech Stack**
- **Frontend**: React 18 + TypeScript + Vite
- **State**: Zustand for lightweight state management
- **Editor**: CodeMirror 6 with language support
- **PWA**: Vite PWA plugin with service worker
- **Styling**: CSS with mobile-first responsive design
- **APIs**: GitHub REST API + OpenAI Chat Completions

### **Local Development**
```bash
npm install          # Install dependencies
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Check code quality
```

### **Project Structure**
```
src/
├── components/
│   ├── CLI.tsx           # Command interface
│   ├── Editor.tsx        # Code editor with diff
│   └── ConfigOverlay.tsx # Settings modal
├── services/
│   ├── github.ts         # GitHub API integration
│   ├── ai.ts            # OpenAI API integration  
│   └── diff.ts          # Text comparison utilities
├── store.ts             # Zustand state management
├── App.tsx              # Main application
└── App.css              # Responsive styling
```

### **WebSocket Console & File Transfer Setup**
```bash
# 1. Create WebSocket server with file transfer support
/socket server 8080              # Show enhanced server template code

# 2. Save template as websocket-server.js and run:
# node websocket-server.js

# 3. Connect from PWA
/socket connect ws://localhost:8080

# 4. Execute commands remotely
/socket exec npm test            # Run tests
/socket exec ls -la              # List files
/socket send hello               # Send to stdin

# 5. Transfer files between devices
/upload myfile.pdf               # Send file to server
/download shared.json            # Get file from server

# 6. View real-time output in CLI
# STDOUT/STDERR streams and file transfer status appear automatically
```

---

## 🌟 **Example Workflows**

### **Basic File Editing**
```bash
/config                              # Setup tokens
/open README.md                      # Load file
Add installation instructions        # AI instruction
/apply                              # Apply changes
/editor                             # Review in editor
/commit "docs: add installation"    # Save changes
```

### **Creating New Files**
```bash
/config                              # Setup tokens
/ls                                  # Browse repository
/new src/components/Header.tsx       # Create new React component
/editor                             # Switch to editor for coding
/commit "feat: add header component" # Save to GitHub
```

### **File Exploration**
```bash
/ls                                  # List root directory
/ls src/                            # List src folder
/cat package.json                   # View file contents
/open src/App.tsx                   # Load for editing
```

### **File Upload & Download (Visual Tool Mode)**
```bash
# Switch to visual file transfer interface
/tool                               # Open file transfer tools
/tool upload                        # Open tools focusing on upload
/tool download                      # Open tools focusing on download

# Use visual interface with forms and buttons to:
# - Select files with file picker
# - Enter GitHub paths or WebSocket filenames  
# - Upload/download with real-time progress
# - View activity log with timestamps
```

### **File Upload & Download via WebSocket CLI**
```bash
# First connect to a WebSocket server
/socket connect ws://localhost:8080

# Upload files from device to server
/upload image.png                   # Opens file picker, sends via WebSocket
/upload document.pdf                # Upload any file type (text/binary)

# Download files from server to device
/download data.json                 # Request file from server
/download report.xlsx               # Download and save locally
```

### **Code Refactoring**
```bash
/open src/utils.js                  # Load JavaScript file
Convert to TypeScript with types    # AI instruction
/apply                             # Apply transformation
/diff                              # Review changes
/commit "refactor: convert to TS"  # Commit changes
```

### **Chinese Development**
```bash
/config                            # 設定 tokens
/open 文件.md                      # 載入中文檔案
為這個專案添加中文說明              # 中文AI指令
/apply                            # 套用變更
/commit "docs: 添加中文說明"        # 提交變更
```

---

## 🧪 **Testing & Validation**

### **Test Prerequisites**
Before running tests, ensure you have a `.config` file in the project root:

```javascript
// .config
{
  "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "openaiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "owner": "your-username",
  "repo": "test-repository",
  "branch": "main",
  "model": "gpt-4o-mini",
  "temperature": 0.3
}
```

### **Automated Test Suite**
```bash
npm test                # Run comprehensive test suite
npm run server          # Start WebSocket server for testing
npm run typecheck       # Verify TypeScript compilation
npm run build           # Test production build
```

### **Test Flows**

#### **🧪 Test Case 1: Basic File Editing Workflow**
**Purpose**: Verify core file editing functionality with AI assistance

```bash
# Setup Phase
/config                              # Load .config automatically
/clear                              # Clear CLI history

# Test Execution
/open README.md                      # Expected: File loaded, shows content
/editor                             # Expected: Switch to editor mode
# UI: Add text "Test modification"
/cli                                # Expected: Return to CLI mode
Add installation instructions        # Expected: AI processing starts
/apply                              # Expected: Changes applied to editor
/diff                               # Expected: Shows differences
/commit "test: add installation"    # Expected: Successful commit with new SHA

# Validation
/cat README.md                      # Expected: Shows updated content with AI changes
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 2: New File Creation Workflow**
**Purpose**: Test file creation with smart templates

```bash
# Setup Phase
/clear

# Test Execution
/ls                                  # Expected: Shows repository structure
/ls src/                            # Expected: Shows src directory contents
/new src/components/TestHeader.tsx   # Expected: Creates file with React template
/editor                             # Expected: Shows template content
# UI: Verify TypeScript template is loaded
/cli
/commit "feat: add test header component" # Expected: New file committed

# Validation
/cat src/components/TestHeader.tsx   # Expected: Shows committed file content
/ls src/components/                  # Expected: TestHeader.tsx appears in listing
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 3: File Exploration Workflow**
**Purpose**: Validate directory browsing and file preview

```bash
# Setup Phase
/clear

# Test Execution
/ls                                  # Expected: Root directory listing with icons
/ls src/                            # Expected: Source directory contents
/ls nonexistent/                    # Expected: Error message
/cat package.json                   # Expected: Shows package.json content (truncated if >50 lines)
/cat src/App.tsx                    # Expected: Shows App.tsx content
/cat missing-file.txt               # Expected: File not found error

# Validation
# Verify all listings show correct file types (📁 for dirs, 📄 for files)
# Verify file sizes are displayed in human-readable format
# Verify error handling for non-existent paths
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 4: Tool Mode UI Workflow**
**Purpose**: Test visual file transfer interface

```bash
# Setup Phase
/clear

# Test Execution
/tool                               # Expected: Opens Tool mode UI
# Steps in Tool Mode:
# 1. Verify GitHub/WebSocket mode toggle works
# 2. Select a small test file (< 1MB)
# 3. Enter path: "test-uploads/sample.txt"
# 4. Click Upload button
# 5. Verify activity log shows progress
# 6. Switch to download section
# 7. Enter path: "test-uploads/sample.txt" 
# 8. Click Download button
# 9. Verify file downloads to local device

/cli                                # Expected: Return to CLI mode

# Validation
/cat test-uploads/sample.txt        # Expected: Shows uploaded file content
# Check Downloads folder for downloaded file
# Verify activity log shows timestamps and status
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 5: WebSocket File Transfer Workflow**
**Purpose**: Test WebSocket server integration and file transfer

```bash
# Prerequisites: WebSocket server running (npm run server)

# Setup Phase
/clear
/socket status                      # Expected: Shows disconnected status

# Test Execution  
/socket connect ws://localhost:8080  # Expected: Connection established
/socket status                      # Expected: Shows connected status
/upload test-document.pdf           # Expected: File picker opens
# UI: Select a PDF file
# Expected: Upload progress, server confirmation
/download test-document.pdf         # Expected: File downloaded to device
/socket exec ls websocket_files     # Expected: Shows uploaded files
/socket exec echo "Hello Server"    # Expected: Server executes and returns output
/socket disconnect                  # Expected: Clean disconnection

# Validation
# Verify server console shows client connection/disconnection
# Verify websocket_files directory contains uploaded file
# Verify local Downloads folder contains downloaded file
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 6: Code Refactoring Workflow**
**Purpose**: Test AI-powered code transformation

```bash
# Setup Phase  
/clear

# Test Execution
/new src/test-utils.js              # Expected: Creates JS file with template
/editor                             # Expected: Shows JavaScript template
# UI: Replace template with simple JS function
/cli
Convert to TypeScript with types    # Expected: AI processes JavaScript → TypeScript
/apply                              # Expected: Code transformed to TypeScript
/diff                               # Expected: Shows JS → TS conversion
/save                               # Expected: Downloads transformed file locally
/commit "refactor: convert to TS"   # Expected: Commits TypeScript version

# Validation
/cat src/test-utils.js              # Expected: Shows TypeScript code with proper types
# Verify Downloads folder contains local copy
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 7: Chinese Language Support**
**Purpose**: Validate CJK text handling and Chinese AI instructions

```bash
# Setup Phase
/clear

# Test Execution
/new 中文测试.md                     # Expected: Creates file with Chinese filename
/editor                             # Expected: Opens editor, shows Chinese filename
# UI: Enter mixed Chinese/English content
# "这是一个测试文件 This is a test file 中英文混合"
/cli
为这个文件添加更多中文内容              # Expected: AI responds to Chinese instruction
/apply                              # Expected: Chinese content added
/commit "docs: 添加中文测试文件"       # Expected: Commits with Chinese message

# Validation  
/cat 中文测试.md                     # Expected: Shows mixed Chinese/English content
# Verify Chinese characters render correctly
# Verify editor handles Chinese input properly
# Status: ✅ PASS / ❌ FAIL
```

#### **🧪 Test Case 8: Error Handling & Recovery**
**Purpose**: Test application resilience and error recovery

```bash
# Setup Phase
/clear

# Test Execution
/open nonexistent-file.txt          # Expected: 404 error, graceful handling
/commit "test"                      # Expected: Error - no file loaded
/apply                              # Expected: Error - no AI changes pending
/socket connect ws://invalid:9999    # Expected: Connection failed error
/upload invalid-file                # Expected: Error - not connected
/branch invalid-branch-name         # Expected: Branch switch (simulated)
/diff                               # Expected: No changes to show
Invalid command syntax              # Expected: Unknown command error

# Validation
# Verify all errors show helpful messages
# Verify app remains functional after errors
# Verify no crashes or broken states
# Status: ✅ PASS / ❌ FAIL
```

### **Performance Test Cases**

#### **🧪 Test Case 9: Large File Handling**
```bash
# Test with files > 100KB
/cat large-file.json                # Expected: Content truncated with warning
/open large-file.json               # Expected: Loads but may warn about size
# UI: Test editor performance with large file
```

#### **🧪 Test Case 10: Mobile Responsiveness**
```bash  
# UI test on mobile device (or DevTools mobile view)
# 1. Test touch interactions in all three modes
# 2. Verify command input works with on-screen keyboard
# 3. Test file picker on mobile
# 4. Verify Tool mode UI scales properly
# Status: ✅ PASS / ❌ FAIL
```

### **Test Results Template**

```markdown
## Test Execution Report

**Date**: ________________
**Tester**: ________________
**Environment**: ________________

| Test Case | Status | Notes |
|-----------|--------|-------|
| Basic File Editing | ✅ PASS / ❌ FAIL | |
| New File Creation | ✅ PASS / ❌ FAIL | |
| File Exploration | ✅ PASS / ❌ FAIL | |
| Tool Mode UI | ✅ PASS / ❌ FAIL | |
| WebSocket Transfer | ✅ PASS / ❌ FAIL | |
| Code Refactoring | ✅ PASS / ❌ FAIL | |
| Chinese Language | ✅ PASS / ❌ FAIL | |
| Error Handling | ✅ PASS / ❌ FAIL | |
| Large Files | ✅ PASS / ❌ FAIL | |
| Mobile UI | ✅ PASS / ❌ FAIL | |

**Overall Status**: ✅ ALL PASS / ❌ ISSUES FOUND
```

---

## 🐛 **Troubleshooting**

### **Common Issues**
| Symptom | Cause | Solution |
|---------|-------|----------|
| 401 on `/open` | Invalid GitHub token | Regenerate PAT with `contents:write` |
| 404 file not found | Wrong path/branch | Check `/branch` and file path |
| 409 commit conflict | Stale SHA | Run `/open` again before `/commit` |
| Empty AI response | Model overloaded | Retry with shorter content |
| Chinese not showing | Font issues | Update browser or check font support |

### **Browser Support**
- **Recommended**: Chrome 90+, Safari 14+, Edge 90+
- **PWA Features**: Requires modern browser with service worker support
- **Chinese Fonts**: Best on macOS/iOS (PingFang), Windows (Microsoft YaHei)

---

## 🔮 **Roadmap**

### **v1.1 - Enhanced Mobile**
- [ ] Offline commit queue
- [ ] Streaming AI responses
- [ ] Gesture navigation
- [ ] File tree browser

### **v1.2 - Advanced Features**
- [ ] Multi-file editing
- [ ] AI patch mode (diffs only)
- [ ] Branch management UI
- [ ] Collaborative editing

### **v1.3 - Extensibility**
- [ ] Multiple AI providers (Anthropic, Azure)
- [ ] Custom prompts/templates
- [ ] Plugin system
- [ ] Local LLM support

---

## 📄 **License**

MIT License - Feel free to use this for personal or commercial projects.

---

## 🙏 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

**Happy mobile coding! 📱✨**  
Use `/help` in the app for quick command reference.
