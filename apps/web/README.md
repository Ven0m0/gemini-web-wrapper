# `apps/web` frontend

This package contains the React 19 + TypeScript + Vite 8 Progressive Web App for the Gemini Web Wrapper workspace.

## What the frontend does

The app provides these primary views:

- **Chat** — main OpenAI-compatible chat interface
- **Agent** — SSE-driven agent chat UI backed by `/v1/agent/chat`
- **Shell** — WebSocket sessions, multi-pane layouts, Ghostty rendering, and `webassembly.sh` fallback
- **Editor** — code editing and review
- **Files** — GitHub file browsing plus repo index status and search
- **Settings** — gateway key, GitHub token, repo, provider, and model configuration

## Tooling

- Bun `1.3.13`
- Node.js `24.15.0`
- React `19.2.5`
- Vite `8.0.8`
- TypeScript `6.0.2`
- Vitest `4.1.4`

## Commands

```bash
cd apps/web
bun install
bun run dev
bun run test
bun run lint
bun run typecheck
bun run build
```

Local dev server: `http://localhost:5173`

The Vite dev server proxies `/v1/*` and `/api/*` to `http://localhost:9000` by default.

## Configuration

The Settings screen manages:

- the backend gateway API key,
- the GitHub token used for private repo browsing and repo indexing,
- the active repository and branch,
- the selected provider and model, and
- optional custom OpenAI-compatible providers.

Built-in providers are defined in `src/services/providers.ts`:

- Gemini
- Anthropic
- GitHub Copilot
- OpenCode Zen
- Kilo Gateway

Users can also add custom providers by supplying a provider ID, model list, and base URL.

## Storage behavior

Configuration persistence is split intentionally:

- `sessionStorage` keeps the full config for the active browser session
- `localStorage` stores only the sanitized non-sensitive configuration when “remember” is enabled

## Build output

A production build writes static assets to:

```text
apps/web/dist
```

That directory is what the release workflow packages and what static hosts such as Netlify or Vercel should publish.
