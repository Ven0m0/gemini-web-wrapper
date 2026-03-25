---
name: language-optimization
description: Optimize code for readability, performance, maintainability, and security across Bash, Python, and Rust. Use when asked to improve code quality, optimize performance, add type safety, or refactor for idioms.
user-invocable: true
disable-model-invocation: false
allowed-tools: "Bash, Read, Write, Edit, Glob, Grep"
---

# Language Optimization

Optimize code across languages following universal principles and language-specific idioms.

<instructions>

## Workflow

Think through optimization systematically:

1. **Analyze**: Identify issues - lint errors, type errors, performance bottlenecks, security gaps
2. **Profile first**: Measure before optimizing performance (never optimize without data)
3. **Apply fixes**: Follow language-specific standards from `instructions/`
4. **Verify**: All tests pass, metrics improved, no regressions

## Universal Principles

<principles>

| Principle | Rule                                                 |
| --------- | ---------------------------------------------------- |
| KISS      | Simple over clever; readability first                |
| YAGNI     | Don't build before needed; no premature optimization |
| DRY       | Extract repeated logic; single source of truth       |
| Fail Fast | Validate early; specific error messages              |
| Security  | No secrets in code; validate at boundaries           |

</principles>

## Optimization Targets (Priority Order)

1. **Correctness**: Fix bugs, handle edge cases
2. **Type safety**: Add/improve type annotations
3. **Readability**: Clear names, reduce nesting, simplify logic
4. **Performance**: Only after profiling identifies bottlenecks
5. **Security**: Input validation, secret management, dependency audit

</instructions>

<language_specific>

## Bash/Shell

- Standards: `instructions/bash.instructions.md`
- Always: `set -euo pipefail`, quote variables, use `[[ ]]` not `[ ]`
- Tools: `shellcheck`, `shellharden`
- Prefer: `fd` over `find`, `rg` over `grep`, `sd` over `sed`

## Python

- Standards: `instructions/python.instructions.md`
- Always: type hints on public functions, `T | None` not `Optional[T]`
- Tools: `ruff` (lint+format), `mypy` (types), `pytest` (tests)
- Prefer: generators over lists, `pathlib` over `os.path`, f-strings over `.format()`

## Rust

- Standards: `instructions/rust.instructions.md`
- Always: handle all `Result`/`Option`, use `clippy` lints
- Tools: `clippy` (lints), `rustfmt` (format), `cargo test`
- Prefer: iterators over loops, `&str` over `String` in params, `thiserror` for errors

</language_specific>

<performance_patterns>

## Common Optimizations

| Pattern   | Before                | After                     |
| --------- | --------------------- | ------------------------- |
| Algorithm | O(n^2) nested loops   | O(n) hash map lookup      |
| Caching   | Recompute every call  | Memoize/cache result      |
| Lazy eval | Build full list       | Generator/iterator        |
| Batching  | N individual calls    | Single batch operation    |
| Built-ins | Custom implementation | Standard library function |

## Performance Workflow

1. Set baseline benchmark
2. Profile to find bottleneck (not guess)
3. Apply targeted optimization
4. Measure improvement against baseline
5. Document trade-off if complexity increased

</performance_patterns>

<examples>

### Python: Add type safety

```python
# Before
def get_user(id, include_posts=False):
    user = db.find(id)
    if include_posts:
        user['posts'] = db.posts(id)
    return user

# After
def get_user(user_id: int, *, include_posts: bool = False) -> User | None:
    user = db.find(user_id)
    if user is None:
        return None
    if include_posts:
        user.posts = db.posts(user_id)
    return user
```

### Bash: Modern idioms

```bash
# Before
files=$(find . -name "*.py")
for f in $files; do
    if [ -f "$f" ]; then
        grep -l "TODO" "$f"
    fi
done

# After
fd -e py --type f -x rg -l "TODO" {}
```

### Rust: Idiomatic error handling

```rust
// Before
fn read_config(path: &str) -> String {
    let contents = std::fs::read_to_string(path).unwrap();
    contents
}

// After
fn read_config(path: &Path) -> Result<Config, ConfigError> {
    let contents = std::fs::read_to_string(path)
        .map_err(|e| ConfigError::ReadFailed { path: path.into(), source: e })?;
    toml::from_str(&contents)
        .map_err(|e| ConfigError::ParseFailed { source: e })
}
```

</examples>

## Success Criteria

Optimization is complete when:

- All linter/type checks pass with zero warnings
- Test suite passes with no regressions
- Performance improved (if that was the goal, with measurements)
- Code follows language-specific idioms from `instructions/`

## References

- Language standards: `instructions/bash.instructions.md`, `instructions/python.instructions.md`, `instructions/rust.instructions.md`
- Refactoring patterns: `skills/code-maintenance/`
