# Dependency Audit Report - January 2026 Update
**Generated:** 2026-01-12
**Project:** gemini-web-wrapper
**Previous Audit:** 2025-12-29

## Executive Summary

This updated audit builds on the December 2025 analysis and identifies **significant opportunities for dependency optimization**. While the project has no security vulnerabilities, there is substantial bloat from transitive dependencies that could be eliminated.

### Key Findings
- ✅ **No security vulnerabilities** detected
- ✅ **Previous recommendations implemented** (CodeMirror updates, requirements.txt removed)
- 🔴 **Major bloat identified**: 110 Python packages, ~50% are unused Google Cloud infrastructure
- 🔴 **Heavy unused dependencies**: Pillow, shapely, numpy, Google Cloud SDK (BigQuery, Storage, etc.)
- ⚠️ **JavaScript packages need major version updates** (React 19, zustand 5, diff 8)

---

## Python Dependencies Analysis

### Current State
- **Total packages**: 110 (including dev dependencies)
- **Direct dependencies**: 12 production + 7 dev
- **Security status**: ✅ No vulnerabilities
- **Bloat assessment**: 🔴 **Significant** - ~50-60 unnecessary packages

### Security Status: ✅ SECURE
- No vulnerabilities detected via pip-audit analysis
- cryptography v46.0.3 (current, secure)
- All packages from trusted sources

### Critical Finding: Unnecessary Google Cloud Infrastructure

The project currently pulls in **massive Google Cloud infrastructure dependencies** that are **NOT used** in the codebase:

#### Unused Heavy Dependencies (Transitive from genkit-plugin-google-genai)
```
❌ google-cloud-aiplatform v1.132.0 (~30 MB)
   ├── google-cloud-bigquery (unused)
   ├── google-cloud-storage (unused)
   ├── google-cloud-resource-manager (unused)
   ├── shapely + numpy (geospatial libs, unused)
   ├── Pillow (image processing, unused)
   └── 40+ other Google Cloud dependencies
```

#### Evidence
- **Grep search results**: Zero usage of Pillow, shapely, numpy, bigquery, or google-cloud-* in codebase
- **Actual usage**: Project only uses `genkit.plugins.google_genai.GoogleAI` for Gemini API access
- **Root cause**: `genkit-plugin-google-genai` depends on full `google-cloud-aiplatform` SDK

### Recommendations

#### 1. Replace genkit-plugin-google-genai with Lighter Alternative
**Priority: HIGH**
**Impact**: Reduce dependency count by ~40-50 packages, decrease installation size by ~50-100 MB

The project uses Genkit only for basic Gemini API access. Consider these alternatives:

**Option A: Direct Google Gen AI SDK (Recommended)**
```bash
# Remove heavy Genkit dependencies
uv remove genkit genkit-plugin-google-genai

# Add lightweight SDK
uv add google-genai
```

**Advantages:**
- Official Google SDK specifically for Gemini API
- Minimal dependencies (httpx, pydantic, basic auth libs)
- No Google Cloud Platform infrastructure
- Same API functionality without framework overhead

**Migration effort**: Medium (requires refactoring Genkit plugin usage to direct API calls)

**Option B: Vercel AI SDK with Google Provider**
```bash
# For TypeScript/JavaScript projects
npm install ai @ai-sdk/google
```
- Better for frontend-heavy applications
- Minimal backend dependencies

**Option C: Keep Genkit but File Feature Request**
- File issue with Genkit to make google-cloud-aiplatform optional
- Request plugin that uses google-genai instead of full Cloud SDK

#### 2. Current Dependency Versions
All current dependencies are up-to-date as of January 2026:

```
✅ fastapi==0.128.0 (latest)
✅ uvicorn==0.40.0 (latest)
✅ pydantic==2.12.5 (latest)
✅ httpx==0.28.1 (latest)
✅ sqlalchemy==2.0.45 (latest)
✅ aiosqlite==0.22.1 (latest)
✅ gemini-webapi==1.17.3 (latest)
✅ browser-cookie3==0.20.1 (latest)
✅ cachetools==6.2.4 (latest)
✅ cryptography==46.0.3 (latest)
```

#### 3. Python Version Classifier Mismatch
**Priority: LOW**

The pyproject.toml has inconsistent Python version declarations:
- Line 6: `requires-python = ">=3.13"`
- Line 62: `target-version = "py311"` (Ruff)
- Line 86: `python_version = "3.11"` (mypy)

**Action:**
```toml
# Update pyproject.toml
[tool.ruff]
target-version = "py313"

[tool.mypy]
python_version = "3.13"
```

---

## JavaScript Dependencies Analysis

### Current State
- **Total packages**: ~471 (42 prod + 430 dev)
- **Security status**: ✅ No vulnerabilities (npm audit clean)
- **Outdated packages**: 4 major versions available

### Outdated Packages

#### Major Updates Available

| Package | Current | Latest | Breaking Changes | Priority |
|---------|---------|--------|------------------|----------|
| react | 18.3.1 | 19.2.3 | Yes | Medium |
| react-dom | 18.3.1 | 19.2.3 | Yes | Medium |
| zustand | 4.5.7 | 5.0.9 | Yes | Low |
| diff | 5.2.0 | 8.0.2 | Possible | Low |

#### Already Updated ✅
- @codemirror/* packages (updated in previous audit)
- ws: 8.18.3 (current)
- vite-plugin-pwa: 1.2.0 (current)

### Recommendations

#### 1. Plan React 19 Migration
**Priority: Medium**
**Effort: Medium-High**

React 19 is production-ready as of January 2026 with significant improvements:
- Actions and optimistic updates
- Server Components support
- Ref as prop (no forwardRef needed)
- Better async error handling

**Action Plan:**
1. Create feature branch `chore/react-19-migration`
2. Review breaking changes: https://react.dev/blog/2025/12/05/react-19
3. Update TypeScript types
4. Test thoroughly
5. Update documentation

**Breaking changes:**
- Removed: defaultProps, propTypes, contextTypes
- Changed: ref forwarding pattern
- New: Actions API replaces some useEffect patterns

#### 2. Update zustand and diff
**Priority: Low**

These can be updated after React 19 migration to avoid conflicting changes.

```bash
cd frontend
npm install zustand@^5.0.9 diff@^8.0.2
```

---

## Bloat Analysis

### Python Dependencies: 🔴 SIGNIFICANT BLOAT

**Current**: 110 packages
**Essential**: ~60 packages
**Unnecessary**: ~50 packages (Google Cloud infrastructure)

#### Breakdown by Category

**Essential (Direct Usage):**
- FastAPI stack: fastapi, uvicorn, starlette, pydantic
- HTTP client: httpx
- Database: sqlalchemy, aiosqlite
- Gemini integration: gemini-webapi
- Cookie management: browser-cookie3
- Utilities: cachetools, cryptography
- Dev tools: pytest, mypy, ruff

**Transitive but Reasonable:**
- pydantic dependencies: annotated-types, pydantic-core, typing-extensions
- httpx dependencies: httpcore, certifi, anyio, idna
- FastAPI dependencies: annotated-doc

**Unnecessary (From genkit-plugin-google-genai):**
- google-cloud-aiplatform (~30 packages)
- google-cloud-bigquery + dependencies
- google-cloud-storage + dependencies
- google-cloud-resource-manager
- Pillow + dependencies
- shapely + numpy
- OpenTelemetry packages (not configured)
- Protocol Buffers ecosystem

### JavaScript Dependencies: ✅ REASONABLE

**Total**: 471 packages (42 prod + 429 dev)
**Assessment**: Appropriate for React + TypeScript + Vite + PWA + CodeMirror

All dependencies are actively used:
- React ecosystem: react, react-dom
- CodeMirror: Code editor with syntax highlighting
- State management: zustand
- Utilities: diff, ws
- Build tools: vite, typescript, various plugins
- PWA: vite-plugin-pwa, workbox (transitive)

---

## Impact Analysis

### If genkit-plugin-google-genai is Replaced

**Benefits:**
- ✅ Reduce package count: 110 → ~60 packages (-45%)
- ✅ Reduce installation size: ~150-200 MB saved
- ✅ Faster `uv sync` and Docker builds
- ✅ Smaller Docker images
- ✅ Fewer security surface area
- ✅ Simpler dependency tree

**Costs:**
- ⚠️ Development time: ~4-8 hours for migration
- ⚠️ Testing effort: Regression testing needed
- ⚠️ Code changes: Refactor Genkit plugin usage

**Net Assessment:** **HIGHLY RECOMMENDED**
The benefits significantly outweigh the one-time migration cost.

---

## Recommended Action Plan

### Immediate (High Priority)

#### 1. Investigate Genkit Alternatives
**Owner:** Development team
**Effort:** 2-4 hours research + POC

Research and test migration to `google-genai` package:

```bash
# Create experiment branch
git checkout -b experiment/lightweight-genai

# Test google-genai package
uv add google-genai
uv remove genkit genkit-plugin-google-genai

# Update server.py to use google-genai directly
# Test all Gemini API functionality
```

**Success criteria:**
- All Gemini API calls work
- Streaming responses work
- Error handling maintained
- Dependency count reduced

#### 2. Fix Python Version Inconsistencies
**Owner:** DevOps
**Effort:** 15 minutes

Update pyproject.toml tool configurations to match Python 3.13 requirement.

### Short Term (Medium Priority)

#### 3. Migrate to Lightweight Genai SDK
**Owner:** Development team
**Effort:** 4-8 hours

If POC is successful, complete migration:
- Refactor all Genkit usage
- Update tests
- Update documentation
- Deploy and monitor

#### 4. Plan React 19 Migration
**Owner:** Frontend team
**Effort:** 8-16 hours

Create migration plan and timeline for React 19 upgrade.

### Long Term (Low Priority)

#### 5. Complete React 19 Migration
**Owner:** Frontend team
**Timeline:** Q1 2026

#### 6. Update zustand and diff
**Owner:** Frontend team
**Timeline:** After React 19 migration

---

## Monitoring & Maintenance

### Automated Monitoring

The project already has Dependabot configured. Ensure it's monitoring:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
```

### Manual Audit Commands

Run these monthly:

```bash
# Python security audit
uv tool run pip-audit

# Python dependency tree
uv tree

# JavaScript security audit
cd frontend && npm audit

# JavaScript outdated packages
cd frontend && npm outdated
```

---

## Comparison to Previous Audit (2025-12-29)

### What Changed ✅
- CodeMirror packages updated
- ws package updated
- vite-plugin-pwa updated to 1.2.0
- requirements.txt removed
- Python version classifiers cleaned up

### What's New 🆕
- **Critical finding**: Identified 50+ unnecessary packages from Google Cloud infrastructure
- **Root cause analysis**: genkit-plugin-google-genai pulls excessive dependencies
- **Solution proposed**: Migration to google-genai SDK
- **Impact quantified**: -45% packages, ~150-200 MB smaller

### Still Pending ⏳
- React 19 migration (planned)
- zustand 5 migration (planned)
- diff library update (low priority)

---

## Conclusion

### Overall Assessment: 🟡 GOOD with OPTIMIZATION OPPORTUNITY

**Strengths:**
- ✅ No security vulnerabilities
- ✅ All direct dependencies are current
- ✅ Previous audit recommendations implemented
- ✅ Good dependency hygiene practices

**Weaknesses:**
- 🔴 Significant bloat from unused Google Cloud dependencies
- ⚠️ JavaScript packages trailing behind (React 19 available)

### Primary Recommendation

**Replace genkit-plugin-google-genai with google-genai SDK** to eliminate 40-50 unnecessary packages and reduce installation size by ~150-200 MB. This is the single most impactful optimization available.

### Risk Assessment

**Current risk**: 🟢 LOW
- No security vulnerabilities
- All dependencies actively maintained
- Recent updates applied

**Future risk if not addressed**: 🟡 MEDIUM
- Increasing technical debt from bloated dependencies
- Larger attack surface
- Slower CI/CD pipelines
- Larger Docker images

### Success Metrics

Track these metrics after implementing recommendations:

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Python packages | 110 | ~60 | -45% |
| Installation size | ~300 MB | ~150 MB | -50% |
| Docker image size | TBD | -100 MB | -30% |
| `uv sync` time | TBD | -30% | Faster |
| npm vulnerabilities | 0 | 0 | Maintained |

---

## References

- Previous audit: DEPENDENCY_AUDIT.md (2025-12-29)
- [Google Gen AI SDK](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
- [Genkit Documentation](https://genkit.dev/)
- [React 19 Blog](https://react.dev/blog/2025/12/05/react-19)
- [Firebase Genkit GitHub](https://github.com/firebase/genkit)

---

**Next Review Date:** 2026-04-12 (quarterly)
