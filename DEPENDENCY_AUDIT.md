# Dependency Audit Report
**Generated:** 2025-12-29
**Project:** gemini-web-wrapper

## Executive Summary

This audit analyzed Python and JavaScript dependencies for security vulnerabilities, outdated packages, and unnecessary bloat. Overall, the project maintains good dependency hygiene with **no critical security vulnerabilities** in project dependencies. However, several outdated packages require attention.

### Key Findings
- ✅ **No security vulnerabilities** in direct project dependencies
- ⚠️ **JavaScript packages have major version updates available**
- ⚠️ **Redundant dependency file** (requirements.txt)
- ✅ **All dependencies are actively used** (no bloat detected)
- ✅ **Python dependencies are current**

---

## Python Dependencies Analysis

### Security Status: ✅ SECURE
- Project uses cryptography v46.0.3 (current and secure)
- No vulnerabilities detected in project-managed dependencies
- System-level packages (pip, setuptools) have vulnerabilities but are not part of project deployment

### Dependency Overview (111 total packages)
```
Main Dependencies:
├── fastapi v0.128.0 (current)
├── uvicorn[standard] v0.40.0 (current)
├── pydantic v2.12.5 (current)
├── genkit v0.4.0 (current)
├── genkit-plugin-google-genai v0.4.0 (current)
├── gemini-webapi v1.17.3 (current)
├── httpx v0.28.1 (current)
├── sqlalchemy v2.0.45 (current)
├── aiosqlite v0.22.1 (current)
├── cryptography v46.0.3 (current)
├── browser-cookie3 v0.20.1 (current)
└── cachetools v6.2.4 (current)
```

### Recommendations

#### 1. Remove Redundant Dependency File
**Priority: Medium**

The `requirements.txt` file duplicates the dependencies already defined in `pyproject.toml`.

**Action:**
```bash
# Remove requirements.txt as pyproject.toml is the source of truth
rm requirements.txt
```

**Rationale:**
- Per CLAUDE.md guidelines, project uses `uv` with `pyproject.toml`
- Maintaining two dependency lists creates sync issues
- Modern Python packaging standards favor pyproject.toml

#### 2. Update Classifiers in pyproject.toml
**Priority: Low**

The `requires-python = ">=3.13"` but classifiers list older versions.

**Action:**
Update pyproject.toml:27-30 to reflect actual Python version requirement:
```toml
classifiers = [
  # Remove these outdated entries:
  # "Programming Language :: Python :: 3.10",
  # "Programming Language :: Python :: 3.11",
  # "Programming Language :: Python :: 3.12",
  "Programming Language :: Python :: 3.13",
]
```

#### 3. Consider Updating pytest-asyncio
**Priority: Low**

The project uses pytest-asyncio v1.3.0, which appears very new. Monitor for stability.

### Bloat Analysis: ✅ MINIMAL

All Python dependencies are actively used:
- genkit/genkit-plugin-google-genai: Core AI functionality
- gemini-webapi: Gemini API integration
- browser-cookie3: Cookie management
- cachetools: TTLCache for session management
- FastAPI stack: Web server framework
- SQLAlchemy/aiosqlite: Database layer
- Dev dependencies: All standard tooling (pytest, mypy, ruff)

**No unnecessary dependencies detected.**

---

## JavaScript Dependencies Analysis

### Security Status: ✅ SECURE
No vulnerabilities detected in frontend packages (npm audit clean).

### Outdated Packages

#### Root package.json
```json
{
  "@vercel/analytics": "^1.6.1"  // Current
}
```
✅ Up to date

#### Frontend package.json

**Major Version Updates Available:**

| Package | Current | Latest | Type | Breaking Changes |
|---------|---------|--------|------|------------------|
| react | 18.3.1 | 19.2.3 | Major | Yes - API changes |
| react-dom | 18.3.1 | 19.2.3 | Major | Yes - Synced with React |
| zustand | 4.5.7 | 5.0.9 | Major | Possible - Check migration guide |
| diff | 5.2.0 | 8.0.2 | Major | Possible - API changes |

**Minor Version Updates Available:**

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| @codemirror/lang-javascript | 6.2.2 | 6.2.4 | Patch |
| @codemirror/lang-json | 6.0.1 | 6.0.2 | Patch |
| @codemirror/lang-markdown | 6.3.1 | 6.5.0 | Minor |
| @codemirror/state | 6.4.1 | 6.5.3 | Minor |
| @codemirror/theme-one-dark | 6.1.2 | 6.1.3 | Patch |
| @codemirror/view | 6.36.0 | 6.39.7 | Minor |
| @uiw/react-codemirror | 4.23.6 | 4.25.4 | Minor |
| ws | 8.18.0 | 8.18.3 | Patch |

### Recommendations

#### 1. Update CodeMirror Packages
**Priority: High**

Safe minor/patch updates with bug fixes and improvements.

**Action:**
```bash
cd frontend
npm update @codemirror/lang-javascript @codemirror/lang-json \
  @codemirror/lang-markdown @codemirror/state \
  @codemirror/theme-one-dark @codemirror/view @uiw/react-codemirror
```

#### 2. Update ws Package
**Priority: Medium**

Patch update for WebSocket library.

**Action:**
```bash
cd frontend
npm update ws
```

#### 3. Evaluate React 19 Migration
**Priority: Medium - Plan for Future**

React 19 includes significant improvements but requires migration effort.

**Action Plan:**
1. Review breaking changes: https://react.dev/blog/2025/12/05/react-19
2. Test in separate branch
3. Update documentation for new patterns
4. Consider timing with next major feature release

**Key React 19 Changes:**
- New compiler optimizations
- Actions and transitions improvements
- Ref as prop (no more forwardRef)
- Removed: defaultProps, contextTypes, propTypes

**Migration Effort:** Medium to High

#### 4. Evaluate zustand 5 Migration
**Priority: Low**

Zustand 5 has breaking changes in middleware API.

**Action:**
1. Review migration guide: https://github.com/pmndrs/zustand/releases/tag/v5.0.0
2. Test middleware compatibility
3. Update if React 19 migration is undertaken

#### 5. Evaluate diff Library Update
**Priority: Low**

Major version jump (5 -> 8) may include breaking changes.

**Action:**
1. Check changelog for breaking changes
2. Review usage in codebase
3. Test thoroughly before upgrading

### Bloat Analysis: ✅ MINIMAL

All frontend dependencies are actively used:
- CodeMirror: Code editor functionality
- React: UI framework
- zustand: State management
- ws: WebSocket communication
- diff: Diff functionality
- Vite/TypeScript: Build tooling

**Total dependencies: 447 (38 prod + 406 dev + 57 optional)**

This is reasonable for a React/TypeScript PWA with code editing features.

---

## Recommended Action Plan

### Immediate (High Priority)
1. ✅ Update CodeMirror packages (safe minor/patch updates)
2. ✅ Update ws package (patch update)
3. ✅ Remove requirements.txt (cleanup)

### Short Term (Medium Priority)
4. 📋 Plan React 19 migration
5. 📋 Update Python version classifiers in pyproject.toml
6. 📋 Monitor genkit/gemini-webapi for updates

### Long Term (Low Priority)
7. 📋 Evaluate zustand 5 migration (coordinate with React 19)
8. 📋 Evaluate diff library update (check breaking changes)

---

## Commands to Execute

### Python Cleanup
```bash
# Remove redundant requirements.txt
rm requirements.txt

# Verify dependencies are locked
uv lock --check
```

### JavaScript Updates (Safe)
```bash
cd frontend

# Install dependencies if not present
npm install

# Update safe packages
npm update @codemirror/lang-javascript@^6.2.4 \
  @codemirror/lang-json@^6.0.2 \
  @codemirror/lang-markdown@^6.5.0 \
  @codemirror/state@^6.5.3 \
  @codemirror/theme-one-dark@^6.1.3 \
  @codemirror/view@^6.39.7 \
  @uiw/react-codemirror@^4.25.4 \
  ws@^8.18.3

# Run tests
npm run typecheck
npm run build
```

### JavaScript Updates (Requires Testing)
```bash
# Create feature branch for major updates
git checkout -b chore/update-react-19

# Update React
npm install react@^19.2.3 react-dom@^19.2.3

# Update zustand
npm install zustand@^5.0.9

# Update diff
npm install diff@^8.0.2

# Test thoroughly
npm run typecheck
npm run build
npm run preview
```

---

## Monitoring

### Set Up Dependabot (Recommended)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

### Regular Audit Commands
```bash
# Python security audit
pip-audit

# JavaScript security audit
cd frontend && npm audit

# Check for updates
uv tree
cd frontend && npm outdated
```

---

## Conclusion

The gemini-web-wrapper project maintains **excellent dependency hygiene** with:
- ✅ No security vulnerabilities in active dependencies
- ✅ All dependencies actively used (no bloat)
- ✅ Modern Python packaging with uv/pyproject.toml
- ✅ Current Python dependencies

**Areas for improvement:**
- Update JavaScript packages (safe minor/patch updates available)
- Plan React 19 migration for long-term maintainability
- Remove redundant requirements.txt file
- Set up automated dependency monitoring

**Risk Assessment: LOW**
The current dependency state poses minimal security or maintenance risk.
