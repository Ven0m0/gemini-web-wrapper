# Migration Matrix — Merged AI Coding Workstation

This document maps legacy features from the three source repositories to the merged monorepo structure.

## Source Repositories

| Repository | Primary Contribution |
|------------|---------------------|
| `Ven0m0/gemini-web-wrapper` | Backend/provider maturity, OpenAI-compatible API, multi-provider LLM gateway |
| `Ven0m0/coder-web` | Plugin/MCP extensibility, command/agent/skill taxonomy |
| `Ven0m0/opencode-web` | IDE/workspace UX, chat-mode semantics, local workspace mindset |

---

## Migration Decisions Key

| Decision | Description |
|----------|-------------|
| **keep** | Feature is sound; migrate as-is to destination package |
| **rewrite** | Feature concept is valid but implementation needs rework |
| **postpone** | Feature deferred to a later milestone (M5+) |
| **drop** | Feature removed; no equivalent in merged product |

---

## `Ven0m0/gemini-web-wrapper` → Merged Repo

### Backend Files

| Legacy Path | Decision | Destination | Notes |
|-------------|----------|-------------|-------|
| `server.py` | **rewrite** | `apps/api/server.py` | Restructure for clean route分层; remove stale WebSocket logic |
| `config.py` | **rewrite** | `packages/config/src/affine/config/` | Add typed env loading; Pydantic v2 validation |
| `lifespan.py` | **keep** | `apps/api/lifespan.py` | Startup/shutdown hooks |
| `dependencies.py` | **keep** | `apps/api/dependencies.py` | FastAPI DI patterns |
| `models.py` | **rewrite** | `packages/shared/python/src/affine/shared/` | Canonical Pydantic models; remove app-specific fields |
| `openai_schemas.py` | **rewrite** | `packages/shared/python/src/affine/shared/openai_schemas.py` | Standardize as shared contracts |
| `openai_transforms.py` | **keep** | `packages/shared/python/src/affine/shared/` | Message format transformations |
| `message_transforms.py` | **keep** | `packages/shared/python/src/affine/shared/` | Additional message helpers |
| `response_builder.py` | **rewrite** | `apps/api/response_builder.py` | Normalize SSE event format per canonical stream event |
| `tool_parsing.py` | **keep** | `packages/shared/python/src/affine/shared/tool_parsing.py` | Tool-call parsing utilities |
| `state.py` | **drop** | — | Stateless per-request design; in-memory cache is package-internal |
| `cookie_manager.py` | **rewrite** | `apps/api/cookie_manager.py` | Move to agent-runtime session management |
| `session_manager.py` | **rewrite** | `packages/agent-runtime/src/affine/agent_runtime/session.py` | Session lifecycle |
| `gemini_client.py` | **rewrite** | `apps/api/gemini_client.py` | Backend-owned; frontend should not call directly |
| `github_service.py` | **rewrite** | `packages/github-integration/src/affine/github/service.py` | GitHub REST API logic |
| `composio_service.py` | **rewrite** | `packages/agent-runtime/src/affine/agent_runtime/composio.py` | Tool execution |
| `utils.py` | **keep** | `packages/shared/python/src/affine/shared/` | Shared utilities |
| `llm_core/interfaces.py` | **keep** | `packages/llm-core/src/affine/llm_core/interfaces.py` | LLMProvider Protocol |
| `llm_core/factory.py` | **keep** | `packages/llm-core/src/affine/llm_core/factory.py` | ProviderFactory |
| `llm_core/providers/gemini.py` | **keep** | `packages/llm-core/src/affine/llm_core/providers/gemini.py` | Gemini adapter |
| `llm_core/providers/anthropic.py` | **keep** | `packages/llm-core/src/affine/llm_core/providers/anthropic.py` | Anthropic adapter |
| `llm_core/providers/copilot.py` | **rewrite** | `packages/llm-core/src/affine/llm_core/providers/copilot.py` | Fix placeholder behavior |
| `llm_core/providers/bifrost.py` | **keep** | `packages/llm-core/src/affine/llm_core/providers/bifrost.py` | Bifrost adapter |
| `endpoints/openai.py` | **keep** | `apps/api/endpoints/openai.py` | Mounted and functional |
| `endpoints/tools.py` | **keep** | `apps/api/endpoints/tools.py` | Composio tool execution |
| `endpoints/profiles.py` | **keep** | `apps/api/endpoints/profiles.py` | Cookie profile management |
| `endpoints/chat.py` | **rewrite** | `apps/api/endpoints/chat.py` | Migrate to canonical stream event format |
| `endpoints/gemini.py` | **postpone** | — | Gemini-specific routes deferred |
| `endpoints/github.py` | **rewrite** | `packages/github-integration/src/affine/github/endpoints.py` | File/PR management |
| `endpoints/openwebui.py` | **postpone** | — | Open WebUI integration deferred |
| `endpoints/sessions.py` | **postpone** | — | Session management routes deferred |
| `test_*.py` | **keep** | `apps/api/test_*.py` | Tests follow package |
| `frontend/` | **rewrite** | `apps/web/` | Rewrite with shared contracts and API-first design |

### Frontend Files (from `frontend/`)

| Legacy Path | Decision | Destination | Notes |
|-------------|----------|-------------|-------|
| `src/App.tsx` | **rewrite** | `apps/web/src/App.tsx` | API-first; no direct provider logic |
| `src/store.ts` | **rewrite** | `apps/web/src/store.ts` | Zustand 5; consume generated API types |
| `src/main.tsx` | **keep** | `apps/web/src/main.tsx` | Entry point |
| `src/components/CLI.tsx` | **keep** | `apps/web/src/components/CLI.tsx` | Terminal-style chat UI |
| `src/components/Editor.tsx` | **postpone** | — | CodeMirror editor deferred to workspace package |
| `src/components/ChatWidget.tsx` | **keep** | `apps/web/src/components/ChatWidget.tsx` | Embeddable chat widget |
| `src/components/ChatWindow.tsx` | **keep** | `apps/web/src/components/ChatWindow.tsx` | Full chat window |
| `src/components/ChatDemo.tsx` | **drop** | — | Demo/showcase; not production |
| `src/components/ChatDesignSystem.tsx` | **postpone** | — | Design system deferred |
| `src/components/ConfigOverlay.tsx` | **keep** | `apps/web/src/components/ConfigOverlay.tsx` | Settings overlay |
| `src/components/InstallPrompt.tsx` | **keep** | `apps/web/src/components/InstallPrompt.tsx` | PWA install |
| `src/components/OpenRouterChat.tsx` | **drop** | — | Duplicate of ChatWindow |
| `src/components/PwaDiagnostics.tsx` | **keep** | `apps/web/src/components/PwaDiagnostics.tsx` | Diagnostics panel |
| `src/components/Tool.tsx` | **keep** | `apps/web/src/components/Tool.tsx` | Tool-call display |
| `src/components/PythonRunner.tsx` | **postpone** | — | Pyodide runner deferred |
| `src/components/WebShell.tsx` | **postpone** | — | Browser shell deferred |
| `src/services/ai.ts` | **rewrite** | `apps/web/src/services/ai.ts` | Use generated API client; no raw fetch |
| `src/services/github.ts` | **rewrite** | `apps/web/src/services/github.ts` | Use github-integration package |
| `src/services/websocket.ts` | **postpone** | — | WebSocket deferred |
| `src/services/diff.ts` | **keep** | `apps/web/src/services/diff.ts` | Diff utilities |
| `src/services/python.ts` | **postpone** | — | Pyodide deferred |
| `src/services/wasmer.ts` | **postpone** | — | WASM runtime deferred |
| `src/services/version.ts` | **keep** | `apps/web/src/services/version.ts` | Version helpers |
| `src/utils/jsonHealer.ts` | **keep** | `apps/web/src/utils/jsonHealer.ts` | JSON repair for LLM output |
| `src/codemirror/` | **postpone** | `packages/workspace/` | Editor deferred to workspace package |

---

## `Ven0m0/coder-web` → Merged Repo

### Plugin/MCP System

| Legacy Concept | Decision | Destination | Notes |
|----------------|----------|-------------|-------|
| Command taxonomy | **keep** | `packages/agent-runtime/src/affine/agent_runtime/commands/` | Command registry and execution |
| Agent taxonomy | **keep** | `packages/agent-runtime/src/affine/agent_runtime/agents/` | Agent definition and routing |
| Skill taxonomy | **keep** | `packages/agent-runtime/src/affine/agent_runtime/skills/` | Skill registry |
| Plugin manager UX | **rewrite** | `packages/mcp/src/affine/mcp/` | MCP-first orientation; plugin runtime rework |
| Plugin security/trust model | **rewrite** | `packages/config/`, `apps/api/` | Trust tiers and feature flags |
| Dynamic code execution | **rewrite** | `packages/agent-runtime/` | Sandboxed execution model |
| Token optimization | **rewrite** | `packages/llm-core/src/affine/llm_core/policy/` | Only if benchmarked useful |
| Plugin runtime | **rewrite** | `packages/mcp/` | MCP client/server implementation |
| Compatibility claims | **drop** | — | Unvalidated claims removed |

### Dropped Features

| Legacy Path | Reason |
|-------------|--------|
| Duplicate app shell code | `apps/web` already provides shell |
| Marketing-only abstractions | No place in production codebase |

---

## `Ven0m0/opencode-web` → Merged Repo

### Chat and Workspace

| Legacy Concept | Decision | Destination | Notes |
|----------------|----------|-------------|-------|
| Chat mode semantics | **keep** | `packages/agent-runtime/src/affine/agent_runtime/` | Chat mode routing and state |
| Workspace-first IDE framing | **keep** | `packages/workspace/src/affine/workspace/` | Local file abstraction |
| Tab/navigation concepts | **keep** | `apps/web/src/components/` | Tab UI components |
| Local workspace mindset | **keep** | `packages/workspace/` | Local file operations |
| Provider/settings concepts | **keep** | `apps/web/src/services/`, `packages/config/` | Settings panel |
| Gemini session logic in frontend | **rewrite** | `packages/llm-core/` | Move to backend routing |

### Dropped Features

| Legacy Path | Reason |
|-------------|--------|
| Wrappers duplicated by shared contracts | `packages/shared` provides canonical contracts |
| Frontend-direct provider logic | All LLM calls go through `apps/api` |

---

## Feature Status Summary

### By Milestone

| Milestone | Features |
|-----------|----------|
| **M0** (This document) | Architecture and migration decisions |
| **M1** | Monorepo bootstrap, tooling, CI |
| **M2** | Shared contracts (schemas) |
| **M3** | Provider layer and model routing |
| **M4** | Foundation API (all mounted endpoints functional) |
| **M5** | Frontend shell foundation |
| **M6** | Workspace abstraction and GitHub mode |
| **M7** | Local workspace mode |
| **M8** | Chat-editor coding workflows |
| **M9** | Built-in tools, commands, skills, agents |
| **M10** | MCP integration |
| **M11** | Plugin system |
| **M12+** | Hardening, auth, observability, deprecation |

### By Decision

| Decision | Count |
|----------|-------|
| **keep** | ~35 |
| **rewrite** | ~30 |
| **postpone** | ~15 |
| **drop** | ~8 |

---

## Validation

Before marking migration complete for a package:

1. All "keep" items are physically moved and imports updated
2. All "rewrite" items have a replacement implementation
3. All "postpone" items are tracked in milestone backlog
4. All "drop" items have no remaining references in codebase
5. Tests are updated to reflect new package structure
