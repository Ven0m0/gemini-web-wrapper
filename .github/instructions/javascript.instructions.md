---
applyTo: "**/*.{js,jsx,ts,tsx,mjs}"
---

# JavaScript/TypeScript Standards

## Toolchain

`biome` (zero-config) | `typescript --strict` | `vitest` | `bun`/`pnpm`

```bash
bun install && bun run test --coverage
```

<Standards>

**Types**: Strict mode tsconfig (`strict`, `noImplicitAny`, `strictNullChecks`)
**Interfaces**: `interface` over `type` for object shapes
**Safety**: Type guards instead of `as` casts, `for...of` over `Array.forEach`
**React**: Functional components with hooks, custom hooks for reuse, stable `key` props (not indexes)
**Naming**: Descriptive over abbreviated, functions <50 lines
**Comments**: Explain "why" not "what"; public APIs must have docs
**Imports**: stdlib > third-party > local (alphabetical within groups)

</Standards>

## Patterns

```typescript
interface User {
  id: string;
  name: string;
  roles?: string[];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

**Accessibility**: semantic HTML, `htmlFor` on labels, `lang` on `<html>`, no `javascript:` URLs, `tabIndex={0}` for custom interactive elements.

## Naming Conventions

- **Variables/Functions**: camelCase (`getUserById`, `isActive`)
- **Classes/Interfaces/Types**: PascalCase (`UserService`, `AuthConfig`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- **Booleans**: question form (`isActive`, `hasPermission`, `canEdit`)

## Function Rules

- Maximum 20 lines per function (ideally 5-10)
- Maximum 3 arguments (prefer 0-2)
- Single responsibility - one function = one job
- No unexpected side effects

## Error Handling

- Always use try/catch for async operations
- Provide meaningful error messages with context
- Never swallow errors silently

<Limitations>

- No `enum` - use `as const`
- No non-null assertions (`!`) - use type guards
- No `var` - use `const`/`let`
- No `any` without justification
- No `eval()` or dynamic code execution

</Limitations>

<Security>

- No hardcoded secrets or credentials
- Input validation at system boundaries
- Error messages must not leak implementation details
- Audit dependencies regularly

</Security>
