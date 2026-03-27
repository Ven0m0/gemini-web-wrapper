# AGENTS.md — Gemini Web Wrapper
> @AGENT_RULES.md

Canonical agent and contributor reference. `CLAUDE.md` and `GEMINI.md` are symlinks to this file.

---

<project-overview>

**Gemini Web Wrapper** is a high-performance, multi-provider LLM gateway with an OpenAI-compatible API surface and a Progressive Web App (PWA) frontend. It wraps Google Gemini (and other providers) behind a standard HTTP/SSE interface, enabling drop-in use with OpenAI-compatible clients.

**Core design decisions:**
- Cookie authentication — no API key required for the `gemini-webapi` path
- Dual Gemini backend: `@google/genai` (API key) and `gemini-webapi` (browser cookies)
- OpenAI-compatible `/v1/chat/completions` — drop-in replacement for OpenAI clients
- Stateless server — client maintains conversation history; server is stateless per-request
- Async-first — `async`/`await` throughout
- Validate at system boundaries only; trust internal code

</project-overview>

---

<stack>

| Layer | Technology |
|---|---|
| Backend language | TypeScript 5+ |
| Backend framework | Hono (edge-ready HTTP framework) |
| Serialization | native JSON, Zod for validation |
| LLM providers | Google Gemini (`@google/genai`), Anthropic, GitHub Copilot, Bifrost gateway |
| Tool integration | Composio (external tool execution) |
| Database | better-sqlite3 (cookie/session storage) |
| Frontend language | TypeScript 5+ |
| Frontend framework | React 19 |
| Frontend build | Vite 7 + vite-plugin-pwa |
| Code editor component | CodeMirror 6 + `@uiw/react-codemirror` |
| State management | Zustand 5 |
| Package manager | `bun` (never npm or pnpm) |
| Linter / formatter | ESLint |
| Type checker | tsc (TypeScript) |
| Test framework | Vitest |
| CI | GitHub Actions |
| Containerization | Docker / docker-compose |

</stack>

---

<repo-structure>

```
/
├── apps/
│   ├── api/                          # TypeScript backend (Hono)
│   │   ├── src/
│   │   │   ├── index.ts              # Main server entry point
│   │   │   ├── config/
│   │   │   │   └── settings.ts       # Environment configuration
│   │   │   ├── models/
│   │   │   │   ├── index.ts          # Shared type definitions
│   │   │   │   └── openai-schemas.ts  # OpenAI-compatible schemas
│   │   │   ├── llm-core/
│   │   │   │   ├── interfaces.ts     # LLMProvider interface
│   │   │   │   ├── index.ts          # Provider factory
│   │   │   │   └── providers/
│   │   │   │       ├── gemini.ts     # Google Gemini provider
│   │   │   │       ├── anthropic.ts  # Anthropic Claude provider
│   │   │   │       ├── copilot.ts    # GitHub Copilot provider
│   │   │   │       └── bifrost.ts    # Bifrost gateway provider
│   │   │   ├── services/
│   │   │   │   ├── cookie-manager.ts # Multi-profile cookie persistence
│   │   │   │   ├── session-manager.ts# Conversation history management
│   │   │   │   ├── github.ts         # GitHub REST API integration
│   │   │   │   ├── composio.ts       # Composio tool integration
│   │   │   │   └── index.ts          # Service exports
│   │   │   └── endpoints/
│   │   │       ├── openai.ts         # /v1/chat/completions (OpenAI-compat, SSE)
│   │   │       ├── profiles.ts       # Cookie profile management routes
│   │   │       └── tools.ts          # /tools/composio/* routes
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # React PWA frontend
│       ├── src/
│       │   ├── App.tsx               # Root component
│       │   ├── store.ts              # Zustand global state
│       │   ├── main.tsx              # Entry point
│       │   ├── components/           # React UI components
│       │   ├── services/             # Business-logic / API services
│       │   ├── utils/
│       │   └── codemirror/           # CodeMirror extensions/config
│       ├── public/                   # Static assets, manifest, service worker
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── config/                       # Shared configuration
│
├── docker-compose.yml                # Full-stack + Bifrost compose
├── renovate.json                     # Renovate dependency update config
├── vercel.json                       # Vercel deployment config
├── .env.example                      # Required environment variables (template)
├── .github/workflows/                # CI/CD (release, dependabot rollup)
├── CLAUDE.md -> AGENTS.md            # Symlink
└── GEMINI.md  -> AGENTS.md           # Symlink
```

</repo-structure>

---

<setup>

### Prerequisites

- Node.js 18+ and [`bun`](https://bun.sh)
- A Google API key (Gemini) or another supported provider key

### Install

```bash
git clone <repo-url> && cd gemini-web-wrapper
cp .env.example .env   # set at minimum: GOOGLE_API_KEY
bun install            # Install all dependencies
```

</setup>

---

<dev-commands>

```bash
# Backend — dev (hot-reload)
cd apps/api && bun run dev       # http://localhost:9000

# Frontend — dev (hot-reload)
cd apps/web && bun run dev       # http://localhost:5173

# Full stack — dev
bun run dev                      # Runs both concurrently

# Full stack — production build
bun run build
bun run start                    # Frontend served at http://localhost:9000/

# Docker
docker-compose up bifrost                # Bifrost gateway only
docker-compose --profile full-stack up  # Bifrost + app
```

</dev-commands>

---

<code-quality>

Run in this order before every commit:

```bash
bun run typecheck             # TypeScript type check
bun run lint                  # ESLint
bun run test                  # Vitest
```

### Running tests

```bash
bun run test                  # All tests
bun run test -v               # Verbose
bun run test src/services     # Specific directory
```

</code-quality>

---

<conventions>

### TypeScript / React

| Topic | Rule |
|---|---|
| Components | Functional with typed props interfaces |
| Naming | `PascalCase` components, `camelCase` functions/vars, `handle` prefix for event handlers |
| State | Local: `useState`/`useReducer`; Global: Zustand store (`store.ts`) |
| API calls | In `src/services/` only — never inline in components |
| TypeScript | Strict mode; no `any` without justification |
| No prop drilling | Use Zustand store or React context for shared state |

### File size limits

| Scope | Limit |
|---|---|
| Provider files (`llm_core/providers/`) | 300 lines |
| Frontend components | 500 lines |
| Frontend services | 400 lines |

Split a file when it significantly exceeds its limit.

### Git

- Never commit to `main` — always use a feature branch.
- Branch naming: `feat/short-desc`, `fix/short-desc`, `chore/short-desc`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat(scope): description`
- One logical change per commit; open draft PRs early for visibility.
- Squash only when merging to `main`.

</conventions>

---

<architecture>

### Provider pattern

`LLMProvider` interface defined in `llm-core/interfaces.ts`. Providers registered in `ProviderFactory` (`llm-core/index.ts`) via structural `switch` dispatch. To add a provider: implement the interface, add a `case` branch in the factory, add required env vars.

### Endpoint modules

Each domain concern lives in its own router file under `endpoints/`. All **active** routers are mounted in `index.ts` via `app.route(...)`. Currently mounted: `openai`, `tools`, `profiles`. New endpoints go in the matching domain file; create a new file only for genuinely new domains; always mount in `index.ts`.

### Configuration

All env vars flow through `Settings` in `config/settings.ts`. Never read `process.env` directly in business logic.

### OpenAI compatibility

Model aliasing in `config/settings.ts` maps OpenAI model names to provider-specific ones:

| OpenAI alias | Resolved model |
|---|---|
| `gpt-4o-mini` | `gemini-2.5-flash` |
| `gpt-4o` | `gemini-2.5-pro` |
| `gpt-4.1-mini` | `gemini-3.0-pro` |
| `claude-3-5-sonnet` | `claude-3-5-sonnet-20241022` |

### Composio tool integration

`services/composio.ts` wraps the Composio SDK. The `endpoints/tools.ts` router exposes `/tools/composio/list` and `/tools/composio/execute`. The service initialises lazily — if `COMPOSIO_API_KEY` is absent the server starts normally and tool endpoints return a 503.

</architecture>

---

<common-tasks>

### Add a new LLM provider

1. Create `llm-core/providers/<name>.ts` implementing `LLMProvider` interface.
2. Add the provider type literal to `ProviderType` in `llm-core/index.ts`.
3. Add a `case "<name>":` branch in `ProviderFactory.create`.
4. Add required env vars to `.env.example` and `config/settings.ts`.
5. Write tests in `test_<name>.ts`.

### Add a new API endpoint

1. Find or create the router file in `endpoints/` for the domain.
2. Implement the handler with full type annotations and a docstring.
3. Mount the router in `index.ts` via `app.route(...)`.
4. Add integration tests to the appropriate test file.
5. Run the full quality gate before committing.

### Activate an existing (unmounted) endpoint router

1. Open `index.ts` and add `import router as <name>Router from './endpoints/<module>'`.
2. Add `app.route('/<path>', <name>Router)` below the existing route calls.
3. Run tests; verify `/docs` shows the new routes.

### Add a frontend component

1. Create `apps/web/src/components/MyComponent.tsx` with a typed props interface.
2. Keep render logic in the component; move API/business logic to `src/services/`.
3. Global state → Zustand store.
4. `cd apps/web && bun run build` to verify.

### Run type checking

```bash
bun run typecheck             # TypeScript (fix all errors before committing)
```

</common-tasks>

---

<dependencies>

### TypeScript (backend)

| Package | Role |
|---|---|
| `hono` | Edge-ready HTTP framework |
| `@google/genai` | Google Gemini SDK |
| `@anthropic-ai/sdk` | Anthropic Claude SDK |
| `openai` | OpenAI SDK (also used for Bifrost gateway) |
| `better-sqlite3` | SQLite for cookie profiles and sessions |
| `zod` | Request/response validation |

### JavaScript (frontend)

| Package | Role |
|---|---|
| `react` 19 | UI framework |
| `zustand` 5 | Lightweight global state — no Redux |
| `@uiw/react-codemirror` | React wrapper for CodeMirror editor |
| `@codemirror/*` | Editor core, language support, themes |
| `diff` | Text diff computation for change visualization |
| `vite` 7 | Build tool and dev server |
| `vite-plugin-pwa` | PWA service worker and manifest generation |
| `typescript` 5 | Static typing |

</dependencies>

---

<environment>

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_API_KEY` | Yes (Gemini) | — | Google AI API key |
| `MODEL_PROVIDER` | No | `gemini` | `gemini` \| `anthropic` \| `copilot` \| `bifrost` |
| `MODEL_NAME` | No | provider default | Override model name |
| `ANTHROPIC_API_KEY` | Yes (Anthropic) | — | Anthropic API key |
| `GITHUB_TOKEN` | Yes (Copilot) | — | GitHub personal access token |
| `BIFROST_URL` | No | `http://localhost:8080/v1` | Bifrost gateway base URL |
| `BIFROST_API_KEY` | No | `sk-bifrost-default` | Bifrost API key |
| `COMPOSIO_API_KEY` | No | — | Composio API key; omit to disable tool endpoints |
| `PORT` | No | `9000` | Server port |
| `FRONTEND_DIST_DIR` | No | `frontend/dist` | Path to built frontend |
| `DEBUG` | No | `false` | Enable debug logging |
| `LOG_LEVEL` | No | `INFO` | Log verbosity |

</environment>

---

<ci-cd>

| Workflow | Trigger | Actions |
|---|---|---|
| `release.yml` | Push `v*` tag | `uv build`, create GitHub Release with generated notes |
| `dependabot-automerge.yml` | Dependabot/Renovate PRs + weekly schedule | Rolls open dependency PRs into a single `deps/rollup` branch and auto-merges |

To release: `git tag v1.2.3 && git push origin v1.2.3`

> There is no automated lint/test CI workflow. Run the quality gate locally before every push.

</ci-cd>
