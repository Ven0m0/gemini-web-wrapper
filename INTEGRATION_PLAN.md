# Chat_github Integration Plan

## Overview
Merge the Chat_github PWA (React-based GitHub file editor) into the gemini-web-wrapper project.

## Current State Analysis

### Gemini-Web-Wrapper (Current Project)
- **Type**: FastAPI backend server
- **Tech**: Python, FastAPI, Genkit, Pydantic
- **Features**:
  - Gemini API wrapper with cookie authentication
  - OpenAI-compatible API endpoints
  - Multi-profile cookie management
  - Simple static HTML/JS frontend
- **Frontend**: Minimal static files in `/web`

### Chat_github (To Integrate)
- **Type**: React PWA (Progressive Web App)
- **Tech**: React 18, TypeScript, Vite, Zustand
- **Features**:
  - Mobile-first GitHub file editor
  - AI-powered file editing (uses OpenAI)
  - Command-line interface in browser
  - WebSocket file transfer
  - Offline support with service workers
  - Chinese language support
- **Frontend**: Full React app in `/src`

## Integration Strategy

### Option 1: Side-by-Side (Recommended)
Add Chat_github as a separate React app served alongside the existing backend.

**Pros:**
- Preserves both projects intact
- Minimal changes to existing code
- Can use gemini-web-wrapper backend as alternative AI provider
- Clear separation of concerns

**Cons:**
- Two separate frontends to maintain
- Larger project footprint

### Option 2: Replace Frontend
Replace the simple web frontend with Chat_github PWA.

**Pros:**
- Single unified frontend
- Better user experience
- Mobile-optimized

**Cons:**
- Loses current simple frontend
- More complex to maintain

### Option 3: Hybrid Backend Integration
Integrate Chat_github as frontend but modify it to use gemini-web-wrapper backend.

**Pros:**
- Best of both worlds
- Uses Gemini instead of OpenAI for AI features
- Backend handles AI calls, frontend focuses on UX

**Cons:**
- Requires significant modifications to Chat_github
- More complex integration

## Recommended Approach: Option 1 + Option 3 Hybrid

### Implementation Steps

#### 1. Directory Structure
```
/home/user/gemini-web-wrapper/
├── server.py                    # Existing FastAPI backend
├── gemini_client.py            # Existing
├── cookie_manager.py           # Existing
├── session_manager.py          # Existing
├── openai_transforms.py        # Existing
├── openai_schemas.py           # Existing
├── utils.py                    # Existing
├── websocket_server.py         # NEW: Chat_github WebSocket server
├── web/                        # Existing simple frontend
│   ├── index.html
│   ├── app.js
│   └── style.css
├── chat-github/                # NEW: Chat_github PWA
│   ├── src/
│   ├── public/
│   ├── dist/                   # Built files
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
└── pyproject.toml
```

#### 2. Backend Enhancements
Add new endpoints to `server.py`:
- `/github/list` - List repository files
- `/github/read` - Read file content
- `/github/write` - Write/commit files
- `/github/branches` - List/switch branches
- WebSocket endpoint for file transfer

#### 3. Frontend Integration
- Copy Chat_github to `/chat-github` subdirectory
- Modify Vite config to work with gemini-web-wrapper backend
- Update API calls to use local backend instead of OpenAI directly
- Serve built files from FastAPI

#### 4. Configuration
- Add GitHub integration settings to `.env`
- Update CORS settings for React dev server
- Configure WebSocket proxy

#### 5. Build Process
- Add npm scripts to pyproject.toml or separate Makefile
- Build React app to `chat-github/dist`
- Serve from FastAPI static files

## Benefits of This Approach

1. **Use Gemini Instead of OpenAI**: Chat_github currently uses OpenAI API, but with backend integration it can use Gemini (cheaper, faster)
2. **Cookie Authentication**: Leverage existing cookie management for Gemini WebAPI
3. **Unified API**: Single backend handles both chat and GitHub operations
4. **Mobile-First**: Get professional mobile UI
5. **Backward Compatible**: Keep existing `/chat`, `/code` endpoints working
6. **Progressive Enhancement**: Can migrate gradually

## Next Steps

1. ✅ Analyze both codebases
2. ✅ Create integration plan
3. ⏳ Copy Chat_github files to subdirectory
4. ⏳ Add GitHub API endpoints to server.py
5. ⏳ Add WebSocket server integration
6. ⏳ Modify Chat_github to use local backend
7. ⏳ Update dependencies (add Node.js deps)
8. ⏳ Test integration
9. ⏳ Update documentation
10. ⏳ Commit and push

## Technical Considerations

### Dependencies
- Add Node.js/npm build process
- Keep Python dependencies separate
- Use uv for Python (as per CLAUDE.md)

### Type Safety
- Maintain Python type hints (pyrefly)
- Maintain TypeScript in React app
- Define shared API types

### Testing
- Keep existing pytest for backend
- Add Playwright tests from Chat_github
- Integration tests for new endpoints

### Performance
- Serve built React app statically
- Use existing orjson, uvloop optimizations
- WebSocket for real-time features

## Timeline Estimate
- Copy and setup: 30 min
- Backend endpoints: 1-2 hours
- Frontend modifications: 1-2 hours
- Testing: 1 hour
- Documentation: 30 min
- Total: 4-6 hours

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing API | High | Keep all existing endpoints |
| Dependency conflicts | Medium | Use separate package.json |
| Build complexity | Low | Add clear build scripts |
| CORS issues | Medium | Configure properly in dev/prod |
