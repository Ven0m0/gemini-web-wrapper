---
applyTo: "apps/web/**/*.{js,jsx,ts,tsx,mjs}"
---

# Frontend JavaScript/TypeScript Guidance

## Scope

This file applies to the React + TypeScript frontend in `apps/web`.

- Keep UI rendering in components.
- Move API access, adapters, and non-trivial browser logic into `src/services/`.
- Keep shared application state in `src/store.ts` via Zustand.
- Do not embed provider secrets or call provider SDKs directly from the frontend.

## Toolchain

- Package manager: `bun`
- Lint: `oxlint src` and `biome lint .`
- Format: `biome format --write .`
- Type-check: `tsc --noEmit`
- Build: `vite build`
- Tests: `bun run test` currently exits successfully with `No tests configured`

## Validation

```bash
cd apps/web
bun install
bun run lint
bun run typecheck
bun run build
```

- Run the full sequence when changing frontend code.
- Keep frontend changes compatible with the current Bun lockfile and Vite build.

## Expectations

- Use typed functional React components and preserve strict TypeScript expectations.
- Prefer `interface` for object-shaped contracts and avoid `any` unless there is no practical alternative.
- Use type guards instead of unsafe casts and avoid non-null assertions.
- Prefix intentionally unused variables or parameters with `_` so `oxlint` and Biome stay quiet.
- Keep imports grouped as standard library, third-party, then local modules.
- Use semantic HTML and preserve existing accessibility behavior.
