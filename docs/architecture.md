# Architecture — Merged AI Coding Workstation

## 1. Product Scope

An open-source, privacy-first AI coding workstation combining the backend/provider maturity of `Ven0m0/gemini-web-wrapper`, the plugin/MCP extensibility of `Ven0m0/coder-web`, and the IDE/workspace UX and chat-mode semantics of `Ven0m0/opencode-web`.

### Primary Goals

| Goal | Description |
|------|-------------|
| Privacy-first | No mandatory cloud services; prefer local execution |
| OpenAI-compatible API | Drop-in replacement for OpenAI clients |
| Multi-provider LLM gateway | Google Gemini, Anthropic Claude, GitHub Copilot, Bifrost |
| Browser cookie auth | `gemini-webapi` path requires no API key |
| Plugin architecture | MCP tool integration via Composio |
| Workspace-aware chat | IDE-like context propagation and file editing |

### Non-Goals (Out of Scope)

- Mandatory cloud dependency of any kind
- Closed-source components
- Windows-specific tooling (first-class Linux/macOS support)
- Native mobile apps (web-only for now)
- Commercial licensing requirements beyond AGPL-3.0

---

## 2. Package Architecture

### 2.1 Monorepo Layout

```
/
├── apps/
│   ├── web/                  # React 19 PWA (Vite 7)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── store.ts      # Zustand global state
│   │   │   ├── main.tsx
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── utils/
│   │   │   └── codemirror/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── api/                  # FastAPI + Uvicorn (uvloop)
│       ├── server.py         # Main entry point
│       ├── config.py         # Pydantic Settings (env vars)
│       ├── lifespan.py       # Startup/shutdown
│       ├── dependencies.py   # FastAPI DI
│       ├── models.py         # Shared Pydantic models
│       ├── endpoints/        # Router modules (one concern per file)
│       ├── llm_core/          # Provider abstraction layer
│       │   ├── interfaces.py # LLMProvider Protocol
│       │   ├── factory.py    # ProviderFactory (structural match dispatch)
│       │   └── providers/
│       │       ├── gemini.py
│       │       ├── anthropic.py
│       │       ├── copilot.py
│       │       └── bifrost.py
│       ├── composio_service.py
│       ├── cookie_manager.py # aiosqlite multi-profile cookie persistence
│       ├── session_manager.py
│       ├── gemini_client.py  # gemini-webapi client wrapper
│       ├── github_service.py
│       └── pyproject.toml
│
├── packages/
│   ├── shared/                # Shared Python + TypeScript types/schemas
│   │   ├── python/
│   │   │   ├── pyproject.toml
│   │   │   └── src/affine/shared/
│   │   │       ├── models.py
│   │   │       ├── openai_schemas.py
│   │   │       └── tool_parsing.py
│   │   └── types/             # TypeScript shared types
│   │       ├── package.json
│   │       └── src/
│   │
│   ├── llm-core/              # Provider abstraction (mirrors llm_core/)
│   │   ├── pyproject.toml
│   │   └── src/affine/llm_core/
│   │       ├── interfaces.py
│   │       ├── factory.py
│   │       └── providers/
│   │
│   ├── agent-runtime/         # Tool execution, session management
│   │   ├── pyproject.toml
│   │   └── src/affine/agent_runtime/
│   │       ├── session.py
│   │       ├── composio.py
│   │       └── workspace.py
│   │
│   ├── mcp/                   # MCP client/server implementation
│   │   ├── pyproject.toml
│   │   └── src/affine/mcp/
│   │
│   ├── workspace/             # File system operations, git integration
│   │   ├── pyproject.toml
│   │   └── src/affine/workspace/
│   │
│   ├── github-integration/    # GitHub REST API, file/PR management
│   │   ├── pyproject.toml
│   │   └── src/affine/github/
│   │
│   ├── ui/                    # Shared React components
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── config/                # Typed env/config loading
│   │   ├── pyproject.toml
│   │   └── src/affine/config/
│   │
│   └── observability/          # Logging, metrics, tracing
│       ├── pyproject.toml
│       └── src/affine/observability/
│
├── docs/
│   ├── architecture.md        # This file
│   ├── runtime-modes.md
│   ├── migration-matrix.md
│   └── examples/
│
├── scripts/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml            # web + api + shared CI
│   │   ├── release.yml
│   │   └── dependabot-automerge.yml
│   └── skills/
│
├── pyproject.toml             # Root Python workspace
├── package.json               # Root Bun workspace
├── bun.lockb
├── uv.lock
├── CLAUDE.md -> AGENTS.md
└── GEMINI.md -> AGENTS.md
```

### 2.2 Package Boundaries and Ownership

| Package | Language | Owner | Responsibility |
|---------|----------|-------|----------------|
| `apps/web` | TypeScript/React | Frontend team | PWA UI, Zustand store, API calls |
| `apps/api` | Python | Backend team | FastAPI app, endpoints, LLM providers |
| `packages/shared` | Python + TypeScript | All | Shared Pydantic models, TypeScript types |
| `packages/llm-core` | Python | Backend team | Provider abstraction, factory dispatch |
| `packages/agent-runtime` | Python | Backend team | Session management, tool execution |
| `packages/mcp` | Python | Backend team | MCP protocol client/server |
| `packages/workspace` | Python | Backend team | File system, git operations |
| `packages/github-integration` | Python | Backend team | GitHub REST API |
| `packages/ui` | TypeScript/React | Frontend team | Shared React components |
| `packages/config` | Python | Backend team | Typed environment loading |
| `packages/observability` | Python | Backend team | Logging, metrics |

### 2.3 API Ownership

All HTTP endpoints are owned by `apps/api`. Frontend (`apps/web`) consumes only the API — no shared API code.

| Prefix | Router | Status |
|--------|--------|--------|
| `/v1/chat/completions` | `openai.py` | **Mounted** |
| `/tools/composio/*` | `tools.py` | **Mounted** |
| `/profiles/*` | `profiles.py` | **Mounted** |
| `/chat`, `/chatbot` | `chat.py` | Not mounted |
| `/gemini/*` | `gemini.py` | Not mounted |
| `/github/*` | `github.py` | Not mounted |
| `/openwebui/*` | `openwebui.py` | Not mounted |
| `/sessions/*` | `sessions.py` | Not mounted |

**Mounting new routers:** Import in `server.py` and call `app.include_router(...)`.

---

## 3. Execution Modes

Three mutually exclusive runtime modes control which features are available.

| Mode | Flag | Description |
|------|------|-------------|
| **server-managed** | `RUNTIME_MODE=server-managed` | Full API server; frontend is built static assets served by API |
| **browser-only** | `RUNTIME_MODE=browser-only` | No API server; frontend runs standalone with browser-only providers |
| **local-workspace-enabled** | `RUNTIME_MODE=local-workspace-enabled` | Full API + local workspace daemon for file system operations |

Default: `server-managed`.

Feature availability by mode:

| Feature | server-managed | browser-only | local-workspace-enabled |
|---------|----------------|--------------|-------------------------|
| OpenAI-compatible API | ✅ | ❌ | ✅ |
| Cookie profile auth | ✅ | ❌ | ✅ |
| Composio tools | ✅ | ❌ | ✅ |
| GitHub integration | ✅ | ❌ | ✅ |
| Local file editing | ❌ | ❌ | ✅ |
| Gemini webapi | ✅ | ✅ | ✅ |
| Gemini API key | ✅ | ❌ | ✅ |

---

## 4. Trust Model

Four trust tiers; all code execution is gated by the effective tier of the current session.

| Tier | Name | Description | Shell exec | Remote plugins | Local workspace |
|------|------|-------------|------------|----------------|-----------------|
| **safe** | Safe | No execution of untrusted content | ❌ | ❌ | ❌ |
| **trusted-local** | Trusted Local | Local code only, no network | ✅ | ❌ | ✅ |
| **trusted-remote** | Trusted Remote | Local + verified remote tools | ✅ | ✅ (verified) | ✅ |
| **experimental** | Experimental | All features enabled | ✅ | ✅ (any) | ✅ |

**Trust tier assignment:** Environment variable `TRUST_TIER` (default: `trusted-local`).

---

## 5. Feature Flags

Feature flags gate experimental or heavyweight capabilities.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `localWorkspace` | bool | `false` | Enable local workspace daemon (implies `local-workspace-enabled` mode) |
| `browserOnlyProviders` | bool | `false` | Only allow browser-based LLM providers |
| `vision` | bool | `true` | Enable vision/multimodal input |
| `shellExec` | bool | `false` | Enable shell command execution |
| `remotePlugins` | bool | `false` | Allow loading MCP plugins from remote sources |
| `experimentalMcp` | bool | `false` | Enable experimental MCP protocol features |

---

## 6. Data Flows

### 6.1 OpenAI-Compatible Chat Completion

```
Client → POST /v1/chat/completions
       → dependencies.get_model_config()
       → ProviderFactory.create(provider_type)
       → LLMProvider.chat(messages, tools, params)
       → response_builder.build_sse_response()
       → SSE stream or JSON
```

### 6.2 Tool Execution (Composio)

```
LLM returns tool_call
→ openai_transforms.parse_tool_calls()
→ tool_parsing.parse_tool_call()
→ composio_service.execute_tool(action, params)
→ SSE event back to client
```

### 6.3 Cookie Profile Management

```
Client → /profiles/*
       → cookie_manager.CookieManager
       → aiosqlite (cookie_store.db)
       → gemini_client.use_profile(profile_id)
```

---

## 7. Security Considerations

1. **Input validation at boundaries**: All env vars validated via Pydantic; request bodies validated at FastAPI endpoints.
2. **No API key required for `gemini-webapi`**: Cookie-based auth only; keys stored server-side.
3. **Trust tier enforcement**: Shell exec and remote plugins gated by trust tier.
4. **Stateless requests**: Server maintains no conversation state; client sends full history.
5. **Session isolation**: Each conversation session is isolated; cookies stored per-profile.

---

## 8. Testing Strategy

Tests are organized by package. Async tests use **anyio** (not asyncio directly).

| Package | Test file | Runner |
|---------|-----------|--------|
| `apps/api` | `test_*.py` | `uv run pytest` |
| `packages/llm-core` | `test_bifrost.py` | `uv run pytest` |
| `packages/config` | (to be added) | `uv run pytest` |
| `packages/shared` | (to be added) | `uv run pytest` |

**Quality gate (run before every commit):**
```bash
uv run ruff format .          # 1. Format
pyrefly check                 # 2. Type check
uv run ruff check . --fix     # 3. Lint (auto-fix)
uv run pytest                 # 4. Tests
```

Frontend:
```bash
cd apps/web && bun run build  # Catches TypeScript errors
```

---

## 9. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google AI API key (Gemini) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_PROVIDER` | `gemini` | `gemini` \| `anthropic` \| `copilot` \| `bifrost` |
| `MODEL_NAME` | provider default | Override model name |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `GITHUB_TOKEN` | — | GitHub personal access token |
| `BIFROST_URL` | `http://localhost:8080/v1` | Bifrost gateway base URL |
| `BIFROST_API_KEY` | `sk-bifrost-default` | Bifrost API key |
| `COMPOSIO_API_KEY` | — | Composio API key; omit to disable tool endpoints |
| `PORT` | `9000` | Server port |
| `FRONTEND_DIST_DIR` | `apps/web/dist` | Path to built frontend |
| `DEBUG` | `false` | Enable debug logging |
| `LOG_LEVEL` | `INFO` | Log verbosity |
| `RUNTIME_MODE` | `server-managed` | Execution mode |
| `TRUST_TIER` | `trusted-local` | Trust tier |
| `localWorkspace` | `false` | Feature flag |
| `browserOnlyProviders` | `false` | Feature flag |
| `vision` | `true` | Feature flag |
| `shellExec` | `false` | Feature flag |
| `remotePlugins` | `false` | Feature flag |
| `experimentalMcp` | `false` | Feature flag |

---

## 10. Gate Structure (Implementation Milestones)

| Gate | Focus | Key deliverables |
|------|-------|-----------------|
| G1 | Foundation | Monorepo structure, shared packages, API shell |
| G2 | LLM Core | All providers wired to shared interfaces |
| G3 | API | All endpoints mounted and functional |
| G4 | Frontend shell | PWA installs, basic chat works end-to-end |
| M4 | Full merge | All legacy features migrated, tested |
| M5 | Observability | Metrics, tracing, logging complete |
| M6 | Release | Public launch, docs, versioning |
