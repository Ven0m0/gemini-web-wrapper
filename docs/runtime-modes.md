# Runtime Surfaces and Application Modes

The repository no longer uses the older `RUNTIME_MODE`, `TRUST_TIER`, or feature-flag model described in previous drafts. The current implementation is simpler:

- a **frontend application** with multiple in-app views, and
- a **backend API gateway** whose behavior changes mainly through configuration and auth.

## Frontend application modes

The web app stores its current mode in `apps/web/src/store.ts` and switches views in `apps/web/src/App.tsx`.

| Mode | Description | Backing surface |
| --- | --- | --- |
| `chat` | Main chat UI for `/v1/chat/completions` | `OpenRouterChat` |
| `agent` | SSE-based agent conversations | `AgentChat` |
| `shell` | WebSocket shells, Ghostty terminal rendering, `webassembly.sh` fallback | `UnifiedShell` |
| `editor` | File editing and diff/review workflows | `Editor` |
| `tool` | GitHub file browsing plus repo index status and symbol search | `Tool` |
| `settings` | Provider, repo, GitHub token, and gateway key configuration | `ConfigOverlay` |
| `chat-demo` | Alternate/demo chat surface kept in the app state | `ChatDemo` |

### Shell runtime details

The shell view supports:

- saved WebSocket endpoints,
- multiple active panes,
- a Ghostty-based terminal renderer, and
- an embedded `webassembly.sh` fallback for browser-only command execution.

### Provider runtime details

The Settings view exposes both built-in and custom providers:

- built-in: Gemini, Anthropic, Copilot, OpenCode Zen, Kilo Gateway
- custom: any OpenAI-compatible endpoint with a provider ID and base URL

Request bodies may carry:

- `x_provider`
- `x_provider_api_key`
- `x_provider_base_url`

When those fields are present, the backend uses them before falling back to server-side defaults.

## Backend runtime behavior

The FastAPI app is configured through `packages/config/src/affine/config/settings.py`.

### Auth modes

| Mode | Behavior |
| --- | --- |
| Open mode | `API_KEY` unset; `/v1/*` endpoints do not require a bearer token |
| Protected mode | `API_KEY` set; `/v1/*` endpoints require `Authorization: Bearer <API_KEY>` |

`/health` stays public in both cases.

### Provider execution

The backend resolves a request in this order:

1. Use request-level provider override fields when present.
2. If no valid override is available, use the configured `MODEL_PROVIDER` and provider credentials.
3. For unknown provider names with a `base_url`, use the shared `OpenAICompatibleProvider` transport.

### Development proxying

During local frontend development, Vite proxies these paths to the API server running on `http://localhost:9000` by default:

- `/v1/*`
- `/api/*`

That means the usual local runtime split is:

- frontend on `http://localhost:5173`
- backend on `http://localhost:9000`

## Indexing runtime surfaces

### GitHub repo index

`/v1/repo/*` provides a persistent repository index for GitHub-hosted codebases. The frontend uses this surface in the Files view to:

- trigger indexing,
- poll indexing status, and
- search indexed symbols and snippets.

### Local semantic index

`/v1/local-index/*` provides local workspace indexing backed by `packages/code-index` and LanceDB. This surface is API-first and can be used outside the frontend.

## Operational summary

Today the runtime model is best understood as:

- **one configurable API gateway**,
- **one multi-mode frontend**, and
- **two indexing subsystems** (GitHub repo index and local semantic index).

If the repository later reintroduces formal runtime modes or feature flags, this document should be updated to describe the implemented behavior instead of roadmap concepts.
