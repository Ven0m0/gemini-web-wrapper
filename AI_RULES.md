# AI Development Rules & Tech Stack Guidelines

## Tech Stack Overview

- **Backend**: FastAPI (Python 3.10+) with ASGI for async performance
- **Frontend**: React 18 + TypeScript + Vite + CodeMirror 6 + Zustand
- **AI Core**: Genkit (Google GenAI SDK) + gemini-webapi for dual API access
- **Database**: SQLite (aiosqlite) for cookie/profile persistence
- **Deployment**: Vercel (frontend) + Render/Heroku (backend) or Vercel Serverless Functions
- **Authentication**: Browser cookies via rookiepy + profile management
- **UI Components**: shadcn/ui + Tailwind CSS for responsive design
- **WebSockets**: ws library for real-time file transfer
- **PWA**: Vite PWA plugin for installable mobile experience

## Library Usage Rules

### Backend (Python)
1. **FastAPI** - All HTTP endpoints and async server logic
2. **Genkit** - Primary LLM interface for Google AI models
3. **gemini-webapi** - Cookie-authenticated access to Gemini web features
4. **Pydantic** - All request/response data validation
5. **aiosqlite** - Async SQLite for cookie/profile storage
6. **rookiepy** - Automatic cookie extraction from browsers
7. **httpx** - All HTTP client requests (GitHub API, etc.)
8. **cachetools** - In-memory caching for sessions (TTLCache)
9. **orjson** - Fast JSON serialization for all responses
10. **uvloop** - Performance optimization for async event loop

### Frontend (TypeScript/React)
1. **React + TypeScript** - All UI components and state management
2. **Zustand** - Global state management (no Redux)
3. **CodeMirror 6** - Code editor with syntax highlighting
4. **@uiw/react-codemirror** - React wrapper for CodeMirror
5. **shadcn/ui** - Pre-built accessible UI components
6. **Tailwind CSS** - All styling (no vanilla CSS files)
7. **Vite** - Build tool and dev server
8. **Vite PWA** - PWA configuration and service worker
9. **WebSocket** - Native browser API for real-time communication
10. **diff** - Text diffing for change visualization

### AI Integration
1. **Google GenAI (via Genkit)** - Primary model access (gemini-2.5-flash/pro)
2. **gemini-webapi** - Cookie-authenticated web interface access
3. **OpenAI compatibility** - Translate to/from OpenAI messages format
4. **Tool calling** - Prompt injection for function calling support
5. **Streaming** - SSE for real-time response tokens
6. **Multimodal** - Image input support via base64 encoding

### Database & Storage
1. **SQLite (aiosqlite)** - Cookie/profile persistence only
2. **In-memory caching** - User sessions with TTL expiration
3. **localStorage** - Client-side config storage (opt-in)
4. **File system** - Static frontend assets only (Vercel)

### Deployment Architecture
1. **Vercel** - Frontend hosting with automatic HTTPS
2. **Vercel Serverless Functions** - Backend API endpoints
3. **Vercel Postgres** - Serverless database for user data
4. **Environment variables** - All secrets and configuration
5. **Static assets** - Frontend build output via Vite

## Key Principles

1. **Mobile-first design** - Prioritize small screen UX
2. **Progressive Web App** - Installable with offline capabilities
3. **Cookie authentication** - No API keys required for Gemini
4. **Dual backend support** - Genkit (API) + gemini-webapi (cookies)
5. **OpenAI compatibility** - Drop-in replacement for /v1/chat/completions
6. **Stateless server** - Client manages conversation history
7. **Performance focused** - Async/await throughout with thread pools
8. **Security conscious** - Validate all inputs, sanitize outputs
9. **Type safety** - 100% type coverage with Pydantic/mypy
10. **Minimal dependencies** - Only add libraries with clear purpose

## Deployment Rules

1. **Vercel frontend** - Static build with client-side routing
2. **Vercel Serverless Functions** - API endpoints in /api directory
3. **Vercel Postgres** - Database for user profiles and settings
4. **Environment variables** - Never commit secrets to repository
5. **No local file writes** - Use Vercel's ephemeral filesystem only
6. **CORS configuration** - Allow frontend origin in backend
7. **Health checks** - Implement /api/health endpoint
8. **Error boundaries** - Graceful error handling in UI and API