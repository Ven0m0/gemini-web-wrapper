# Development Guidelines

This document contains critical information about working with this codebase. Follow these guidelines precisely.

## Core Development Rules

### 1. Package Management
- **ONLY use uv, NEVER pip**
- Installation: `uv add package`
- Running tools: `uv run tool`
- Upgrading: `uv add --dev package --upgrade-package package`
- **FORBIDDEN**: `uv pip install`, `@latest` syntax

### 2. Code Quality
- Type hints required for all code
- Use pyrefly for type checking:
  - Run `pyrefly init` to start
  - Run `pyrefly check` after every change and fix resulting errors
  - Explicit None checks for Optional types
  - Type narrowing for strings
  - Version warnings can be ignored if checks pass
- Public APIs must have docstrings
- Functions must be focused and small
- Follow existing patterns exactly
- Line length: 88 chars maximum

### 3. Testing Requirements
- Framework: `uv run pytest`
- Async testing: use anyio, not asyncio
- Coverage: test edge cases and errors
- New features require tests
- Bug fixes require regression tests
- Test frequently with realistic inputs and validate outputs

### 4. Code Style
- PEP 8 naming (snake_case for functions/variables)
- Class names in PascalCase
- Constants in UPPER_SNAKE_CASE
- Document with docstrings
- Use f-strings for formatting

## Development Philosophy

- **Simplicity**: Write simple, straightforward code over clever solutions
- **Readability**: Make code easy to understand
- **Performance**: Consider performance without sacrificing readability
- **Maintainability**: Write code that's easy to update
- **Testability**: Ensure code is testable
- **Reusability**: Create reusable components and functions
- **Less Code = Less Debt**: Minimize code footprint

## Coding Best Practices

### Code Organization
- **Early Returns**: Use to avoid nested conditions
- **Function Ordering**: Define composing functions before their components
- **File Organization**: Balance file organization with simplicity - use an appropriate number of files for the project scale
- **Clean Logic**: Keep core logic clean and push implementation details to the edges

### Naming and Style
- **Descriptive Names**: Use clear variable/function names (prefix handlers with "handle")
- **Constants Over Functions**: Use constants where possible
- **TODO Comments**: Mark issues in existing code with "TODO:" prefix

### Development Approach
- **DRY Code**: Don't repeat yourself
- **Minimal Changes**: Only modify code related to the task at hand
- **Build Iteratively**: Start with minimal functionality and verify it works before adding complexity
- **Functional Style**: Prefer functional, immutable approaches where they improve clarity
- **Build Test Environments**: Create testing environments for components that are difficult to validate directly

## File Organization Guidelines

### When to Create New Files

**Backend:**
- New LLM provider: Create in `llm_core/providers/`
- New service/manager: Create at root level (e.g., `xyz_manager.py`)
- Shared utilities: Add to `utils.py` unless very large
- New API schemas: Add to `openai_schemas.py` or create new schema file
- Tests: Create `test_xyz.py` for new modules

**Frontend:**
- New page/view: Create component in `frontend/src/components/`
- New service: Create in `frontend/src/services/`
- Shared utilities: Add to existing service or create new one
- Types: Define inline or in component file (avoid separate types files)

### When to Edit Existing Files

**Always prefer editing existing files when:**
- Adding new endpoint to `server.py`
- Adding new utility function to `utils.py`
- Extending existing component functionality
- Adding new Pydantic model to `openai_schemas.py`
- Updating existing tests in `test_server.py`
- Modifying provider behavior in `llm_core/providers/`

**File size guidelines:**
- `server.py` is already 1,618 lines - acceptable for main app
- Individual providers should stay under 300 lines
- Components should stay under 500 lines
- Services should stay under 400 lines
- Split files only when they exceed these limits significantly

### Current File Structure

```
/
├── Backend Core
│   ├── server.py              # Main app (1,618 lines) - OK to extend
│   ├── cookie_manager.py      # Cookie management
│   ├── session_manager.py     # Session management
│   ├── gemini_client.py       # Gemini WebAPI wrapper
│   ├── github_service.py      # GitHub integration
│   ├── openai_schemas.py      # Pydantic models
│   ├── openai_transforms.py   # Message transforms
│   └── utils.py               # Shared utilities
│
├── LLM Abstraction
│   └── llm_core/
│       ├── interfaces.py      # Protocol definitions
│       ├── factory.py         # Provider factory
│       └── providers/         # Provider implementations
│           ├── gemini.py
│           ├── anthropic.py
│           └── copilot.py
│
├── Frontend
│   └── frontend/
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── services/      # Business logic
│       │   ├── store.ts       # Global state
│       │   └── main.tsx       # Entry point
│       └── dist/              # Build output
│
└── Tests
    └── test_server.py         # API tests
```

## System Architecture

### Overview
This is a **high-performance multi-provider LLM gateway** with:
- **FastAPI Backend**: Async/await with uvloop, orjson, strict typing
- **React PWA Frontend**: TypeScript, Vite, CodeMirror, Zustand
- **Multi-Provider Support**: Gemini, Anthropic Claude, GitHub Copilot
- **OpenAI Compatibility**: Drop-in replacement for OpenAI API
- **GitHub Integration**: File editing and PR management
- **Cookie Management**: Multi-profile support with SQLite

### Core Components

**Backend (`/` root):**
- `server.py` (1,618 lines) - Main FastAPI application with lifespan management
- `llm_core/` - Provider abstraction layer
  - `interfaces.py` - LLMProvider Protocol definition
  - `factory.py` - Factory pattern for provider instantiation
  - `providers/` - Gemini, Anthropic, Copilot implementations
- `cookie_manager.py` - Multi-profile cookie persistence (aiosqlite)
- `session_manager.py` - Conversation history management
- `gemini_client.py` - Wrapper for gemini-webapi
- `github_service.py` - GitHub REST API integration
- `openai_schemas.py` - Pydantic models for OpenAI API
- `openai_transforms.py` - Message format transformations
- `utils.py` - Utility functions and error handling

**Frontend (`/frontend/`):**
- `src/components/` - React components (CLI, Editor, Tool, etc.)
- `src/services/` - Business logic (ai, github, websocket, etc.)
- `src/store.ts` - Zustand state management
- `dist/` - Built files (served by FastAPI)
- `vite.config.ts` - Build configuration

**Tests:**
- `test_server.py` - Comprehensive API endpoint tests

### Architecture Patterns

1. **Provider Pattern**: Universal `LLMProvider` protocol with factory-based instantiation
2. **Async-First**: All I/O operations use async/await with thread pool for blocking ops
3. **Type Safety**: 100% type-annotated code with mypy strict mode
4. **Stateless Design**: Client maintains conversation history, server is stateless
5. **OpenAI Compatibility**: Drop-in replacement with model aliasing and SSE streaming

### Key Dependencies

**Backend:**
- Data validation: Pydantic 2.7+
- LLM Providers: google-genai (via genkit), anthropic, github-copilot-sdk, gemini-webapi
- Performance: orjson, uvloop, cachetools
- Database: aiosqlite, sqlalchemy
- HTTP: httpx, fastapi, uvicorn

**Frontend:**
- Framework: React 18.3.1, TypeScript 5+
- Build: Vite
- Editor: CodeMirror 6
- State: Zustand
- Python: Pyodide 0.28.2 (in-browser Python execution)

### Environment Configuration

Required environment variables (set in `.env` or environment):
```bash
GOOGLE_API_KEY=your_key_here           # Required for Gemini
MODEL_PROVIDER=gemini                   # gemini|anthropic|copilot (default: gemini)
MODEL_NAME=gemini-2.5-flash            # Optional, provider-specific model
ANTHROPIC_API_KEY=your_key_here        # Required for Anthropic
GITHUB_TOKEN=your_token_here           # Required for Copilot
```

Model aliases for OpenAI compatibility:
- `gpt-4o-mini` → `gemini-2.5-flash`
- `gpt-4o` → `gemini-2.5-pro`
- `claude-3-5-sonnet` → `claude-3-5-sonnet-20241022`

### API Endpoints

- `GET /health` - Health check
- `POST /chat` - Basic chat (no history)
- `POST /chatbot` - Chat with conversation history
- `POST /v1/chat/completions` - OpenAI-compatible endpoint (SSE streaming)
- `POST /v1/models` - List available models
- `GET /github/*` - GitHub integration endpoints
- `GET /` - Serve PWA frontend (static files from /frontend/dist)

### Development Tools
- Use context7 MCP to check details of libraries when needed
- Use browser DevTools for frontend debugging
- Use FastAPI's auto-generated docs at `/docs` for API testing

## Code Formatting

### Ruff
- Format: `uv run ruff format .`
- Check: `uv run ruff check .`
- Fix: `uv run ruff check . --fix`
- Critical issues:
  - Line length (88 chars)
  - Import sorting (I001)
  - Unused imports
- Line wrapping:
  - Strings: use parentheses
  - Function calls: multi-line with proper indent
  - Imports: split into multiple lines

### Pre-commit Checklist

**Backend:**
1. Run formatters: `uv run ruff format .`
2. Run type checking: `pyrefly check`
3. Run linting: `uv run ruff check . --fix`
4. Run tests: `uv run pytest`
5. Check git status before commits
6. Follow existing patterns
7. Test thoroughly

**Frontend:**
1. Build: `cd frontend && npm run build`
2. Lint: `cd frontend && npm run lint`
3. Type check: TypeScript will error on build if types are wrong
4. Test manually in browser

## Frontend Development

### Setup
```bash
cd frontend
npm install
npm run dev  # Development server on http://localhost:5173
npm run build  # Production build to /frontend/dist
npm run lint  # ESLint
```

### Stack
- **React 18.3.1** with TypeScript 5+
- **Vite** for fast builds and HMR
- **CodeMirror 6** for code editing
- **Zustand** for state management
- **ESLint** for linting

### Code Style
- Use functional components with hooks
- TypeScript strict mode enabled
- Props interfaces defined for all components
- Use Zustand store for global state
- Services pattern for business logic
- Avoid prop drilling - use store or context

### Component Structure
```typescript
// Good component structure
interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState<string>('');

  // Effects
  useEffect(() => {
    // ...
  }, []);

  // Handlers
  const handleClick = () => {
    onAction?.();
  };

  // Render
  return <div>{title}</div>;
}
```

### Service Pattern
- Keep API calls in `/services/` directory
- Use async/await
- Handle errors appropriately
- Export typed functions

### State Management
- Global state: Use Zustand store (`src/store.ts`)
- Local state: Use React hooks
- Complex state: Consider useReducer
- Server state: Fetch on mount, store in component/store

### Build Output
- Production builds go to `/frontend/dist`
- Backend serves these files at root `/`
- Service worker in `/public/sw.js` for PWA
- Manifest at `/public/manifest.json`

### Testing Frontend
- Manual testing in browser during development
- Test PWA features (install, offline)
- Test on multiple browsers if UI changes
- Test mobile responsiveness

## Running the Application

### Development Mode

**Backend Only:**
```bash
# Set up environment
export GOOGLE_API_KEY="your_key"
export MODEL_PROVIDER="gemini"  # or anthropic, copilot

# Install dependencies
uv sync

# Run server (serves static frontend from /frontend/dist if available)
uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**Frontend + Backend (Full Stack):**
```bash
# Terminal 1: Backend
export GOOGLE_API_KEY="your_key"
uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend dev server
cd frontend
npm run dev  # Runs on http://localhost:5173
```

**Production:**
```bash
# Build frontend
cd frontend && npm run build && cd ..

# Run backend (serves built frontend)
export GOOGLE_API_KEY="your_key"
uv run uvicorn server:app --host 0.0.0.0 --port 8000
```

### Testing

**Backend Tests:**
```bash
uv run pytest                    # Run all tests
uv run pytest -v                 # Verbose output
uv run pytest test_server.py     # Specific file
uv run pytest -k test_health     # Specific test pattern
```

**Frontend Testing:**
- Manual browser testing during development
- Open http://localhost:5173 (dev) or http://localhost:8000 (production)
- Test all major features and user flows
- Check browser console for errors

### Debugging

**Backend:**
- Use `print()` statements (appears in terminal)
- Use FastAPI docs at http://localhost:8000/docs
- Check server logs in terminal
- Use Python debugger: `import pdb; pdb.set_trace()`

**Frontend:**
- Use browser DevTools (F12)
- Check Console for errors
- Use React DevTools extension
- Network tab for API calls
- Use `console.log()` for debugging

**Common Issues:**
- **Import errors**: Run `uv sync` to install dependencies
- **Type errors**: Run `pyrefly check` and fix reported errors
- **Frontend not updating**: Clear browser cache or hard refresh (Ctrl+Shift+R)
- **API errors**: Check backend logs and /docs endpoint
- **Port already in use**: Kill process on port or use different port

## Git Workflow

### Branch Strategy
- Always use feature branches; do not commit directly to `main`
- Name branches descriptively: `fix/auth-timeout`, `feat/api-pagination`, `chore/ruff-fixes`
- Keep one logical change per branch to simplify review and rollback

### Commit Practices
- Make atomic commits (one logical change per commit)
- Prefer conventional commit style: `type(scope): short description`
  - Examples: `feat(eval): group OBS logs per test`, `fix(cli): handle missing API key`
- Squash only when merging to `main`; keep granular history on the feature branch

### Pull Requests
- Create a detailed message of what changed
- Focus on the high-level description of the problem and how it is solved
- Don't go into code specifics unless it adds clarity
- Open a draft PR early for visibility; convert to ready when complete
- Ensure tests pass locally before marking ready for review
- Use PRs to trigger CI/CD and enable async reviews

### Issue Linking
- Before starting, reference an existing issue or create one
- Use commit/PR messages like `Fixes #123` for auto-linking and closure

### Practical Workflow
1. Create or reference an issue
2. `git checkout -b feat/issue-123-description`
3. Commit in small, logical increments
4. `git push` and open a draft PR early
5. Convert to ready PR when functionally complete and tests pass
6. Merge after reviews and checks pass

## Error Resolution

### CI Failure Fix Order
1. Formatting (`ruff format`)
2. Type errors (`pyrefly check`)
3. Linting (`ruff check --fix`)

### Common Issues

**Line Length:**
- Break strings with parentheses
- Multi-line function calls
- Split imports

**Type Errors:**
- Get full line context
- Check Optional types
- Add type narrowing
- Verify function signatures
- Add None checks
- Narrow string types
- Match existing patterns

### Best Practices
- Run formatters before type checks
- Keep changes minimal
- Follow existing patterns
- Document public APIs
- Test thoroughly

---

## Quick Reference

### Common Commands

**Backend Development:**
```bash
uv sync                           # Install dependencies
uv add package                    # Add new package
uv add --dev package              # Add dev dependency
uv run uvicorn server:app --reload  # Run dev server
uv run pytest                     # Run tests
uv run pytest -v                  # Verbose tests
uv run ruff format .              # Format code
uv run ruff check . --fix         # Lint and fix
pyrefly check                     # Type check
```

**Frontend Development:**
```bash
cd frontend
npm install                       # Install dependencies
npm run dev                       # Dev server (port 5173)
npm run build                     # Production build
npm run lint                      # ESLint
```

**Full Stack:**
```bash
# Build and run production
cd frontend && npm run build && cd ..
uv run uvicorn server:app --host 0.0.0.0 --port 8000
```

### Key File Locations

- Main app: `server.py`
- LLM providers: `llm_core/providers/`
- Tests: `test_server.py`
- Frontend components: `frontend/src/components/`
- Frontend services: `frontend/src/services/`
- Config: `pyproject.toml`, `.env`
- Dependencies: `uv.lock`, `frontend/package.json`

### Project Statistics

- Python version: 3.13+
- Total backend files: ~19 Python files
- Total frontend components: 8+ React components
- Main app size: ~1,618 lines (server.py)
- Test coverage: Comprehensive API endpoint tests
- Dependencies: 109 Python packages, 30+ npm packages
