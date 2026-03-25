# Agent Rules

This repository is a merged successor to:
- Ven0m0/gemini-web-wrapper
- Ven0m0/coder-web
- Ven0m0/opencode-web

Legacy repos are donors, not architecture. Port concepts and targeted code only.

## Current vs. Target Structure

The repo is being migrated toward a monorepo layout. **Current** paths are flat; **target** paths are shown in the constraints below. Do not introduce the target layout until a PLAN.md task explicitly calls for it.

| Concern | Current path | Target path |
|---|---|---|
| Frontend | `frontend/` | `apps/web` |
| Backend API | `server.py` (root) | `apps/api` |
| Provider abstraction | `llm_core/` | `packages/llm-core` |
| Workspace abstraction | *(not yet implemented)* | `packages/workspace` |
| Agent/tool runtime | *(not yet implemented)* | `packages/agent-runtime` |
| MCP subsystem | *(not yet implemented)* | `packages/mcp` |
| Shared contracts/schemas | `models.py`, `openai_schemas.py` | `packages/shared` |

## Absolute Constraints

- One frontend.
- One backend API.
- One provider abstraction.
- One workspace abstraction.
- One agent/tool runtime.
- One MCP subsystem.
- One canonical schema source.

If any change violates these, stop and mark the current task blocked.

## Allowed Status Values

- todo
- in_progress
- blocked
- done
- cancelled

## Execution Discipline

- Do tasks strictly in dependency order from `PLAN.md`.
- Do not start a task until all dependencies are `done`.
- Do not mark a task `done` until all acceptance criteria pass.
- If blocked, write the root cause and the next required fix in the task Notes.

## Architecture Boundaries

- Provider SDKs and provider-specific request shaping live ONLY in the provider abstraction layer (`llm_core/` today; `packages/llm-core` after migration).
- The frontend must NEVER call provider SDKs directly in default modes.
- The frontend must NEVER embed provider keys into bundles.
- Workspace access lives ONLY behind workspace adapters (once `packages/workspace` exists).
- GitHub-specific API behavior lives ONLY in `github_service.py` (today); after migration it moves to `packages/github-integration`, used by `packages/workspace` and `apps/api`.
- Commands, agents, skills, tools, and plugins live ONLY in the agent runtime layer (`endpoints/tools.py` + `composio_service.py` today; `packages/agent-runtime` after migration).
- MCP transports and discovery live ONLY in the MCP subsystem (once `packages/mcp` exists).

## Contracts and Types

- `models.py` and `openai_schemas.py` are the canonical contract sources today. After migration, `packages/shared` takes over.
- No handwritten duplicated DTOs across modules.
- Validate requests at API boundaries and keep internal models aligned.
- Streaming must use one canonical event format (`ChatStreamChunk`) across all providers.

## Forbidden Shortcuts

- Do not copy entire legacy app directories into this repo.
- Do not implement "just for now" provider logic in the frontend.
- Do not add a second workspace model for GitHub vs local. Same abstraction, different adapter.
- Do not add WebSocket streaming for chat unless SSE is proven insufficient.
- Do not expose arbitrary shell execution by default.
- Do not enable remote plugins by default.
- Do not run untrusted plugin code via `eval`, `new Function`, or unrestricted dynamic import.
- Do not implement MCP as UI-only; it must integrate into tool registry with permissions.

## Security Rules

- All mutation paths must be permission-checked and audit logged.
- Secrets must not appear in:
  - API responses (except explicit secret-management endpoints if added later)
  - frontend state persisted to disk by default
  - logs or traces (redact if unavoidable)
- Local workspace mode must be feature-flagged (`localWorkspace`) and opt-in.
- Remote plugins must be feature-flagged (`remotePlugins`) and opt-in.
- MCP server management must be permissioned; MCP tool invocation must be permissioned.
- Enforce payload caps and timeouts on:
  - LLM requests
  - streaming sessions
  - tool execution
  - file operations

## Performance Rules

- Prefer streaming for long responses.
- Avoid adding heavy dependencies. Use existing stack: Bun/TS for frontend and shared packages; Python/FastAPI for API; uv for Python deps.
- Keep provider adapters lean and testable; avoid per-request global initialization where possible.

## Testing Rules

Before moving past foundation API work:
- provider adapter unit tests must exist (Gemini + Anthropic at minimum)
- stream normalization tests must exist
- mode routing tests must exist
- API integration tests must exist for models/providers/chat/stream/profiles
- frontend integration tests must exist for profile select + streaming chat

## Required Logging/Diagnostics

- Every API request gets a request ID.
- Every provider call logs provider, model, mode, latency, and request ID.
- Tool calls must log name, inputs (redacted as needed), outputs (redacted as needed), duration, and permission decision.

## How to Handle Ambiguity

- If the plan does not specify a detail, do not invent. Add a doc/task update and stop.
- If a legacy repo has two conflicting approaches, select the one consistent with these rules, document the choice in the relevant task Notes, and continue.
