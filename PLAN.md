# Merged AI Coding Workstation Plan

## Mission

Build one singular self-hostable AI coding workstation that merges:
- `Ven0m0/gemini-web-wrapper` backend/provider maturity
- `Ven0m0/coder-web` plugin/MCP extensibility
- `Ven0m0/opencode-web` IDE/workspace UX and chat-mode semantics

This repository is the canonical successor. Legacy repos are donors, not architecture.

## Agent Instructions

You are implementing this plan incrementally.

Rules:
- Execute tasks strictly in dependency order.
- Do not start a task until all dependencies are marked `done`.
- Do not mark a task `done` until all acceptance criteria pass.
- If blocked, set task status to `blocked` and record the blocker in the Notes column.
- Do not skip ahead to UI or feature work before shared contracts and provider interfaces exist.
- Do not import entire legacy app folders. Port concepts and targeted code only.
- Update this file as work progresses.
- After completing a task, add a short implementation note and changed paths.
- Preserve package boundaries defined here.
- If a task reveals architectural drift, stop and update the relevant docs task before continuing.

Allowed status values:
- `todo`
- `in_progress`
- `blocked`
- `done`
- `cancelled`

## Hard Constraints

- One frontend.
- One backend API.
- One provider abstraction.
- One workspace abstraction.
- One command registry.
- One plugin manifest spec.
- No provider SDK logic in arbitrary UI components.
- No unrestricted plugin execution.
- No duplicated GitHub business logic across frontend/backend except explicit browser-only mode.
- No shell execution by default.
- No remote plugins by default.
- No feature implementation before contracts exist.

## Execution Modes

- `server-managed`
- `browser-only` gated by feature flag
- `local-workspace-enabled` gated by feature flag

## Trust Tiers

- `safe`
- `trusted-local`
- `trusted-remote`
- `experimental`

## Feature Flags

- `localWorkspace`
- `browserOnlyProviders`
- `vision`
- `shellExec`
- `remotePlugins`
- `experimentalMcp`

## Monorepo Layout

Target end-state layout:

```text
.
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── shared/
│   ├── llm-core/
│   ├── agent-runtime/
│   ├── mcp/
│   ├── workspace/
│   ├── github-integration/
│   ├── ui/
│   ├── config/
│   └── observability/
├── infra/
├── scripts/
├── docs/
└── tests/
```

## Current-State Snapshot

This repo is mid-migration. The strategic target above still stands, but the checked-in code currently looks like this:

- `apps/web` exists and is the active React/Vite frontend shell with chat, tool, editor, PWA, and service modules already present.
- `apps/api` exists as a packaged FastAPI app under `apps/api/src/affine/api`, but legacy Python entrypoints and tests still also exist at the repository root.
- Root-level `server.py`, `config.py`, `llm_core/`, and related tests still overlap with packaged API responsibilities, so ownership is duplicated between the root app and `apps/api`; until that is cleaned up, treat `apps/*` and `packages/*` as the intended long-term source of truth.
- `packages/config`, `packages/shared`, and `packages/llm-core` exist with initial extracted code; planned packages such as `agent-runtime`, `mcp`, `workspace`, `github-integration`, `ui`, and `observability` are not present yet.
- The packaged API currently disables FastAPI docs/OpenAPI output (`docs_url=None`, `redoc_url=None`, `openapi_url=None` in the packaged server), so typed-client generation cannot proceed until schema emission is restored there.
- `docs/architecture.md`, `docs/migration-matrix.md`, and `docs/runtime-modes.md` exist, so the architecture/migration baseline is documented even though implementation has not caught up everywhere.
- Root workspace/tooling scaffolding is present (`package.json` Bun workspaces, Python `pyproject.toml`, GitHub Actions workflows), but package boundaries and generated-contract workflows are still incomplete.

## Package Ownership

| Package | Ownership |
|---|---|
| `apps/web` | UI shell, panels, state, settings, profile UI |
| `apps/api` | routes, orchestration, validation, auth/secrets, API contracts |
| `packages/shared` | canonical models, permissions, stream events |
| `packages/llm-core` | provider adapters, routing, models, prompt policy |
| `packages/agent-runtime` | commands, skills, agents, tools, plugin runtime |
| `packages/mcp` | MCP transports, lifecycle, discovery |
| `packages/workspace` | GitHub/local file abstraction |
| `packages/github-integration` | GitHub API logic |
| `packages/ui` | shared visual primitives |
| `packages/config` | typed env/config |
| `packages/observability` | logs, traces, metrics, audit helpers |

## Definition of Done for v1

A user can:
- create/select a profile
- stream chat using preset modes
- connect a GitHub repo and edit/commit files
- enable local workspace mode and edit/commit local files
- invoke built-in commands and tools
- configure MCP servers and use tools in agent mode
- install trusted local plugins that contribute commands/tools
- review diffs and commit AI-assisted changes
- use the same shell on desktop and mobile/PWA

All mutation paths must be permission-checked and audit logged.

## Stop Conditions

Stop execution immediately if any of these occur:
- provider logic is being added directly to frontend components
- a second workspace abstraction is introduced
- a second command system is introduced
- plugin execution requires arbitrary remote eval
- GitHub mode and local mode require separate editor implementations
- schema drift creates conflicting request/response types across packages

When stopped:
1. mark current task `blocked`
2. document the drift in Notes
3. add or update a docs/architecture task before resuming

## Milestones

Status reflects the repository's current observable state, even where implementation started ahead of an earlier gate.

| ID | Milestone | Status | Priority | Depends On |
|---|---|---|---|---|
| M0 | Architecture freeze and migration matrix | done | p0 | - |
| M1 | Monorepo bootstrap and tooling | in_progress | p0 | M0 |
| M2 | Shared contracts and generated clients | in_progress | p0 | M1 |
| M3 | Provider layer and model routing | in_progress | p0 | M2 |
| M4 | Foundation API | in_progress | p0 | M3 |
| M5 | Frontend shell foundation | in_progress | p0 | M4 |
| M6 | Workspace abstraction and GitHub mode | todo | p0 | M5 |
| M7 | Local workspace mode | todo | p0 | M6 |
| M8 | Chat-editor coding workflows | todo | p0 | M6, M7 |
| M9 | Built-in tools, commands, skills, agents | todo | p0 | M8 |
| M10 | MCP integration | todo | p1 | M9 |
| M11 | Plugin system | todo | p1 | M9, M10 |
| M12 | Version control and review UX | todo | p1 | M8 |
| M13 | PWA/mobile hardening | todo | p2 | M5 |
| M14 | Auth, secrets, permissions, security hardening | todo | p0 | M4, M9, M10, M11 |
| M15 | Observability, testing, evaluation | todo | p0 | M4+ |
| M16 | Legacy repo deprecation and migration completion | todo | p1 | M12, M14, M15 |

## Task Execution Table

| ID | Task | Area | Status | Priority | Depends On | Required Output | Acceptance Criteria | Notes |
|---|---|---|---|---|---|---|---|---|
| T001 | Write merged product scope and architecture doc | docs | done | p0 | - | `docs/architecture.md` | product scope, package boundaries, API ownership, runtime modes, trust model, and non-goals documented | done: architecture baseline captured; paths: docs/architecture.md. |
| T002 | Produce migration matrix for all three repos | docs | done | p0 | T001 | `docs/migration-matrix.md` | major legacy features mapped to keep/rewrite/postpone/drop with destination packages | done: legacy-to-target mapping documented; paths: docs/migration-matrix.md. |
| T003 | Define runtime modes, trust tiers, and feature flags | architecture | done | p0 | T001 | `docs/runtime-modes.md` | flags and modes named, scoped, and ready for implementation | done: runtime/trust/flag baseline documented; paths: docs/runtime-modes.md. |
| T004 | Initialize monorepo with Bun workspaces and uv API app | repo | done | p0 | T001 | scaffolded repo structure | `bun run dev` starts web and api; workspace layout matches plan | done: added `@affine/api` workspace scripts, migrated packaged API imports, and switched legacy root entrypoints/scripts to `apps/api` + `apps/web`; paths: package.json, apps/api/package.json, apps/api/src/affine/api/server.py, _legacy_api.py, server.py, start.sh, build.sh, deploy.sh, setup_dev.sh, README.md, vercel.json. |
| T005 | Configure linting, formatting, typecheck, pre-commit | tooling | in_progress | p0 | T004 | root configs and scripts | lint and typecheck pass on scaffold | API Ruff now passes through the workspace script, but repo-wide typecheck/build is still blocked by existing frontend TypeScript errors and existing API pyrefly findings. |
| T006 | Add CI for web, api, and shared packages | ci | in_progress | p0 | T004,T005 | `.github/workflows/*` | CI passes on scaffold and caches dependencies | `.github/workflows/ci.yml` now exports the packaged API `PYTHONPATH`, but CI acceptance still depends on resolving the remaining web/api typecheck failures. |
| T007 | Add typed env/config loading | config | in_progress | p0 | T004 | `packages/config` | missing env fails fast; config is typed | Shared settings now carry CORS/model-alias fields and are wired into the packaged API/config module, but fail-fast behavior is still not uniform for all providers and startup paths. |
| T008 | Add local Docker/compose stack | infra | todo | p1 | T004,T007 | Dockerfiles and compose | local stack boots successfully | |
| T009 | Define chat/model/profile/stream schemas | shared | in_progress | p0 | T004 | schema files in `packages/shared` | frontend and backend consume same contracts | `packages/shared` contains initial shared models/provider config, but schema coverage and imports are not complete yet. |
| T010 | Define workspace/file/repo schemas | shared | todo | p0 | T009 | schema files in `packages/shared` | neutral across GitHub and local adapters | |
| T011 | Define tools/commands/skills/agents/permissions schemas | shared | in_progress | p0 | T009 | schema files in `packages/shared` | runtime contracts stable enough for later milestones | `packages/shared/src/affine/shared/tools.py` exists, but commands/skills/agents/permissions coverage is still incomplete. |
| T012 | Define plugin and MCP schemas | shared | todo | p1 | T011 | schema files in `packages/shared` | plugin and MCP contracts unblock later runtime work | |
| T013 | Implement schema export/codegen strategy | shared | todo | p0 | T009,T010,T011 | generated/shared types | one source of truth; no duplicated DTO maintenance | |
| T014 | Create `packages/llm-core` and normalized provider interface | llm-core | in_progress | p0 | T013 | llm-core package | API can depend on llm-core without app-specific imports | `packages/llm-core` exists with interfaces/factory/providers, but API code still carries duplicate provider logic locally. |
| T015 | Port Gemini provider | llm-core | in_progress | p0 | T014 | Gemini adapter | generate/stream tests pass; model metadata exposed | Gemini provider code exists in `packages/llm-core`, but plan-level acceptance still depends on shared tests and package adoption. |
| T016 | Port Anthropic provider | llm-core | in_progress | p0 | T014 | Anthropic adapter | generate/stream tests pass; model metadata exposed | Anthropic provider code exists in `packages/llm-core`, but plan-level acceptance still depends on shared tests and package adoption. |
| T017 | Implement generic OpenAI-compatible provider | llm-core | todo | p1 | T014 | OpenAI-compatible adapter | contract tests pass | |
| T018 | Implement OpenRouter adapter | llm-core | todo | p1 | T017 | OpenRouter adapter | contract tests pass | |
| T019 | Build provider registry and model catalog | llm-core | in_progress | p0 | T015,T016 | registry service | providers/models discoverable; enable/disable via config | Factory/registry code exists; a full model catalog and config-driven discovery are still incomplete. |
| T020 | Implement mode routing policies | llm-core | todo | p0 | T019 | mode resolver | standard/fast/thinking/search/edit/agent resolve deterministically | |
| T021 | Normalize provider stream events | llm-core | todo | p0 | T015,T016,T019 | stream normalizer | one canonical stream event shape for frontend/API | |
| T022 | Add prompt policy modules | llm-core | todo | p1 | T020 | prompt policy module | policies are backend-owned and testable | |
| T023 | Add llm-core unit and contract tests | test | todo | p0 | T015,T016,T019,T020,T021 | llm-core test suite | provider/routing regressions covered in CI | |
| T024 | Create foundation FastAPI structure | api | in_progress | p0 | T014,T007 | API app skeleton | route layer cleanly structured with injected services | `apps/api/src/affine/api` exists with routers and services, but root/runtime duplication still blurs ownership. |
| T025 | Implement `/v1/models` and `/v1/providers` | api | todo | p0 | T019,T024 | discovery endpoints | models/providers visible through API | |
| T026 | Implement `/v1/chat/completions` | api | in_progress | p0 | T015,T016,T019,T020,T024 | chat endpoint | Gemini and Anthropic work through one route | An OpenAI-compatible router exists in the API app; shared-contract alignment and acceptance tests are still pending. |
| T027 | Implement streaming chat endpoint with SSE | api | in_progress | p0 | T021,T024,T026 | stream endpoint | canonical provider-agnostic stream works | Current API/server code includes streaming behavior, but canonical cross-provider event normalization is not done yet. |
| T028 | Implement profile CRUD and activation | api | in_progress | p0 | T009,T024 | profile endpoints | profiles selectable without secret leakage | Profile router/modules exist, but secret-reference handling and end-to-end verification are still pending. |
| T029 | Implement secret reference plumbing | api | todo | p0 | T028,T007 | secret handling | credentials resolved without exposing raw secrets in profile payloads | |
| T030 | Add structured logs, request IDs, diagnostics | observability | todo | p0 | T024,T026,T027 | log/trace integration | requests and provider calls are traceable without secret leakage | |
| T031 | Add API rate limits and payload caps | security | todo | p1 | T024 | middleware | oversized/abusive requests are constrained | |
| T032 | Add OpenAPI and typed client generation | api/shared | todo | p0 | T025,T026,T027,T028 | API spec and generated client | frontend uses generated API types | current packaged API state disables OpenAPI/docs, so schema generation work must start by restoring schema output there. |
| T033 | Create initial frontend shell and API wiring | web | in_progress | p0 | T032 | `apps/web` shell | app can call health/models/profiles successfully | `apps/web` is present with store/services/components, but generated-client wiring is not in place yet. |
| T034 | Implement streaming chat panel | web | in_progress | p0 | T027,T033 | chat UI | user can stream replies in UI with provider-agnostic logic | Chat components already exist in `apps/web/src/components`, but they are not yet anchored to the planned provider-agnostic contract layer. |
| T035 | Implement profile selector and settings panel | web | in_progress | p0 | T028,T033 | profile/settings UI | profile selection works end-to-end | Settings/config UI exists; profile-selection flow still needs confirmation against the packaged API contracts. |
| T036 | Add frontend activity log and diagnostics UI | web | in_progress | p1 | T030,T034 | diagnostics UI | request/provider status visible in UI | PWA diagnostics UI exists, but unified request/provider diagnostics are not complete. |
| T037 | Add API integration tests for foundation routes | test | todo | p0 | T025,T026,T027,T028 | API integration test suite | foundation API covered in CI | |
| T038 | Add frontend integration tests for chat/profile flow | test | todo | p1 | T034,T035 | frontend integration tests | critical chat UI flow covered in CI | |
| T039 | Document foundation API and developer startup flow | docs | in_progress | p0 | T032,T034,T035 | root README and docs | new contributor can boot stack and test foundation flows | Multiple docs exist already, but startup/API guidance is still partly stale relative to the current monorepo state. |
| T040 | Freeze legacy repos and add migration pointers | migration | todo | p1 | T002 | legacy repo notices | contributors redirected to merged repo | |

## Task Gates

The agent must not proceed past each gate until all listed tasks are `done`.

### Gate G1: Architecture Gate
Required tasks:
- T001
- T002
- T003

Stop if:
- package boundaries are unclear
- runtime mode responsibilities are unclear

### Gate G2: Repo Bootstrap Gate
Required tasks:
- T004
- T005
- T006
- T007

Stop if:
- `bun run dev` does not start both apps
- config is not typed
- CI does not pass

### Gate G3: Contracts Gate
Required tasks:
- T009
- T010
- T011
- T013

Stop if:
- frontend and backend types drift
- schemas are duplicated manually
- stream event format is not canonical

### Gate G4: Provider Gate
Required tasks:
- T014
- T015
- T016
- T019
- T020
- T021
- T023

Stop if:
- provider behavior differs by route-specific code
- frontend needs provider-specific parsing
- model routing is hardcoded in route handlers

### Gate G5: Foundation API Gate
Required tasks:
- T024
- T025
- T026
- T027
- T028
- T029
- T030
- T032
- T037

Stop if:
- foundation routes fail integration tests
- profiles leak secrets
- stream events are inconsistent across providers

### Gate G6: Initial UI Gate
Required tasks:
- T033
- T034
- T035
- T039

Stop if:
- frontend bypasses API contracts
- stream UI depends on provider-specific logic
- startup docs are incomplete

## Required Implementation Notes Format

After finishing a task, append a short note in the Notes column using this format:
- `done: <summary>; paths: <comma-separated paths>`

If blocked:
- `blocked: <root cause>; next: <required fix>`

## Migration Rules

### From `Ven0m0/gemini-web-wrapper`
Keep:
- provider abstractions
- Gemini and Anthropic provider implementations
- streaming behavior
- OpenAI-compatible route concept
- profiles
- GitHub file API concepts
- frontend shell ideas
- PWA primitives

Rewrite:
- stale docs and setup
- placeholder WebSocket logic
- inconsistent naming
- Copilot placeholder behavior
- any frontend-direct provider logic

Drop:
- dead upstream remnants
- duplicate historical codepaths

### From `Ven0m0/coder-web`
Keep:
- command/agent/skill taxonomy
- plugin manager UX concepts
- MCP-first orientation
- token optimization ideas only if benchmarked useful

Rewrite:
- plugin runtime
- plugin security/trust model
- dynamic code execution model
- compatibility claims unless validated

Drop:
- duplicate app shell code
- marketing-only abstractions

### From `Ven0m0/opencode-web`
Keep:
- chat mode semantics
- workspace-first IDE framing
- tab/navigation concepts
- local workspace mindset
- provider/settings concepts

Rewrite:
- frontend-bound Gemini session logic into backend llm-core routing

Drop:
- wrappers duplicated by shared contracts and backend routes

## Testing Requirements Before Moving Past M4

- unit tests for Gemini provider
- unit tests for Anthropic provider
- stream normalization tests
- model catalog tests
- mode routing tests
- API integration tests for providers/models/chat/stream/profiles
- frontend integration test for profile select + stream chat

## Immediate Next Tasks

1. Finish M1 by making `apps/*` and `packages/*` authoritative: remove duplicate root-level runtime code once imports are migrated, and otherwise mark remaining root copies deprecated/read-only with explicit pointers to `apps/api` and `packages/*`.
2. Prioritize `T032` next (OpenAPI + typed client generation): restore a stable OpenAPI surface in the packaged API so generated clients and contract-driven frontend wiring can proceed.
3. Complete the missing shared schema/codegen work (`T010`-`T013`: workspace/repo schemas, tool/runtime schemas, plugin/MCP schemas, and export/codegen) before taking on more workspace, MCP, plugin, or local-mode feature work.
4. After contracts are stable, finish the already-started foundation path: package-backed provider adoption (`T014`-`T021`), foundation API completion (`T024`-`T030`), and frontend API alignment (`T033`-`T039`).

Do not start new workspace, MCP, plugin, or local-mode feature expansion until the blockers above are resolved and the active Gate G1-G6 dependencies are satisfied again.

## Consolidated Observed Backlog

Only high-signal follow-ups that still matter after the current foundation work are kept here.

| ID | Task | Area | Status | Priority | Depends On | Required Output | Acceptance Criteria | Notes |
|---|---|---|---|---|---|---|---|---|
| T041 | Finish Tool/CLI transport polish if Tool mode remains in scope | web | todo | p2 | T033,T034 | stable Tool/CLI transport behavior | WebSocket/file transfer placeholders are either completed or removed; CLI history behavior is predictable and tested | addresses Tool WebSocket transport, file transfer, and CLI history follow-up work |
| T042 | Remove or hard-fail incomplete provider paths | llm-core/api | todo | p1 | T014,T015,T016,T017,T019,T024 | explicit supported-provider matrix | unsupported providers never fall through to placeholder or `NotImplementedError` behavior at runtime; support matrix is documented and tested | covers unsupported Copilot selection and shared-provider stub cleanup |
| T043 | Align contributor docs with the packaged API and mounted routes | docs | todo | p2 | T024,T032,T039 | updated contributor docs | router status, startup instructions, and package ownership notes match the actual packaged API and frontend entrypoints | covers stale routing, startup, and ownership documentation follow-ups |
