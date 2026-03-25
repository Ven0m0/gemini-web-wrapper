---
applyTo: "**"
---

# Code Quality and Performance Standards

<Goals>

- Systematic code review with constructive feedback
- Performance awareness: measure before optimizing
- Quality gates enforced in CI before merge
- Knowledge sharing through review process

</Goals>

## Code Review

<Standards>

**Evaluate**: correctness, clarity, maintainability, security, performance, test coverage, documentation

**Do NOT**: enforce personal style preferences, require perfection, become adversarial, request out-of-scope features

</Standards>

### Review Process

1. **Context**: Read PR description, linked issues, check scope
2. **Structure**: File layout > module design > implementation > details
3. **Domain Standards**: Apply language-specific rules from relevant instruction files
4. **Security**: No hardcoded secrets, input validation, no info disclosure, deps audited
5. **Tests**: Public methods tested, edge cases covered, 80%+ coverage
6. **Performance**: No O(n^2) where O(n) works, no unnecessary copies, caching for repeated calls

### Comment Prefixes

| Prefix     | Meaning               | Blocks Approval |
| ---------- | --------------------- | --------------- |
| `MUST`     | Critical issue        | Yes             |
| `SHOULD`   | Strong recommendation | Usually         |
| `CONSIDER` | Suggestion            | No              |
| `QUESTION` | Seeking clarification | No              |
| `NITPICK`  | Minor style issue     | No              |

### Approval Criteria

Approve when: all `MUST` addressed, `SHOULD` addressed or explicitly rejected, tests pass, security review passes.
Block when: failing tests, security issues, no test coverage for new code, undocumented breaking changes.

---

## Performance Optimization

<HighLevelDetails>

1. Measure before optimizing (profile, don't guess)
2. Know target latency/throughput/memory constraints
3. Focus on hot paths, not edge cases
4. Document trade-offs
5. Verify improvements with measurements

</HighLevelDetails>

### Common Issues and Fixes

| Issue                  | Problem                       | Fix                            |
| ---------------------- | ----------------------------- | ------------------------------ |
| Algorithm complexity   | O(n^2) where O(n) viable      | Use sets/dicts for lookups     |
| Unnecessary copies     | References suffice            | Use views, generators, borrows |
| Repeated computation   | Same value computed N times   | Cache/memoize results          |
| I/O in hot paths       | DB call per item in loop      | Batch queries                  |
| String concat in loops | O(n^2) from immutability      | Use join/StringBuilder         |
| Memory leaks           | Unbounded caches              | LRU with maxsize, weak refs    |
| Wrong data structure   | List for membership test O(n) | Set for O(1) contains          |

### Performance Targets

| Context        | Metric      | Target  |
| -------------- | ----------- | ------- |
| Web page load  | Initial     | < 3s    |
| UI interaction | Response    | < 100ms |
| API endpoint   | p95 latency | < 200ms |
| DB query       | p95         | < 50ms  |
| CLI startup    | Small ops   | < 100ms |
| CLI operation  | Common      | < 1s    |

### Language-Specific Profiling

- **Python**: `cProfile` + `pstats`, `functools.lru_cache`, generators, numpy for numerics
- **JS/TS**: `console.time/timeEnd`, DevTools Performance, `requestAnimationFrame`, Web Workers
- **Rust**: `cargo bench`, `cargo-flamegraph`, iterators, `#[inline]` (measure first)

---

## Quality Metrics

| Metric                | Target            | Maximum                  |
| --------------------- | ----------------- | ------------------------ |
| Code coverage         | 80% minimum       | 95%+ critical paths      |
| Cyclomatic complexity | < 10              | < 20 (refactor required) |
| Code duplication      | < 3% project-wide | -                        |
| Maintainability index | > 80              | > 60 acceptable          |

## Quality Gates (All PRs)

<Limitations>

- All tests passing
- Coverage >= 80%
- No security vulnerabilities
- Linting passes (language-specific)
- Type checking passes (strict mode)
- No unresolved `MUST` comments
- Documentation updated for public API changes

</Limitations>
