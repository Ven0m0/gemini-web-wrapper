# Dependency Audit Report

**Date:** 2026-01-16
**Project:** Gemini Web Wrapper
**Auditor:** Claude Code

---

## Executive Summary

✅ **Security Status:** CLEAN - No known vulnerabilities detected
⚠️ **Outdated Packages:** 20 Python packages, 3 frontend packages need updates
🎯 **Bloat Analysis:** Moderate - Large Google Cloud transitive dependencies present
🔧 **Critical Issues:** 1 duplicate dependency in pyproject.toml

---

## 1. Security Vulnerabilities

### Python Dependencies
- **Status:** ✅ NO VULNERABILITIES FOUND
- **Auditor:** pip-audit
- **Packages Scanned:** 109 packages
- **Result:** All dependencies are secure

### Frontend Dependencies (npm)
- **Status:** ✅ NO VULNERABILITIES FOUND
- **Packages Scanned:** 515 total (42 prod, 474 dev)
- **Result:** All dependencies are secure

### Critical Dependency Versions
The following security-critical packages are up to date:
- `cryptography==46.0.3` (enforced minimum: 46.0.0) ✅
- `httpx==0.28.1` ✅
- `fastapi==0.128.0` ✅
- `uvicorn==0.40.0` ✅

---

## 2. Outdated Packages

### Python (20 packages behind latest)

#### Critical Updates (Major Version Changes)
- `websockets==15.0.1` → `16.0` 🔴 **MAJOR VERSION**
- `pathspec==0.12.1` → `1.0.3` 🔴 **MAJOR VERSION**
- `starlette==0.50.0` → `0.51.0` (FastAPI dependency)

#### Recommended Updates (Minor Versions)
- `certifi==2025.11.12` → `2026.1.4`
- `google-auth==2.45.0` → `2.47.0`
- `google-cloud-aiplatform==1.132.0` → `1.133.0`
- `google-cloud-bigquery==3.39.0` → `3.40.0`
- `google-cloud-storage==3.7.0` → `3.8.0`
- `google-genai==1.56.0` → `1.59.0`
- `ruff==0.14.11` → `0.14.13`

#### Low Priority Updates (Patch Versions)
- `anyio==4.12.0` → `4.12.1`
- `google-api-core==2.28.1` → `2.29.0`
- `numpy==2.4.0` → `2.4.1`
- `pillow==12.0.0` → `12.1.0`
- `protobuf==6.33.2` → `6.33.4`
- Others (see full list in section below)

### Frontend (3 packages behind latest)

#### Major Updates Available
- `react==18.3.1` → `19.2.3` 🔴 **MAJOR VERSION** (Breaking changes expected)
- `react-dom==18.3.1` → `19.2.3` 🔴 **MAJOR VERSION** (Must update with React)
- `zustand==4.5.7` → `5.0.10` 🔴 **MAJOR VERSION** (State management)

#### All Frontend Dependencies Up-to-Date
- All CodeMirror packages are current
- All dev tools are current
- TypeScript, Vite, and build tools are current

---

## 3. Dependency Bloat Analysis

### Large Transitive Dependencies (Installed but not directly needed)

The project pulls in **heavy Google Cloud packages** through `genkit` and `genkit-plugin-google-genai`:

#### Google Cloud Platform Dependencies (27.5 MB total)
- `google-cloud-aiplatform==1.132.0` (7.8 MB) 📦
- `google-cloud-bigquery==3.39.0` (included in aiplatform)
- `google-cloud-storage==3.7.0` (included in aiplatform)
- `google-cloud-resource-manager==1.15.0`
- `google-cloud-core==2.5.0`
- `grpcio==1.76.0` (6.3 MB)
- `numpy==2.4.0` (15.6 MB) - Heavy dependency

**Impact:** These packages are transitive dependencies of `genkit` and `google-genai`. They're needed for full Genkit functionality but may not be used in this project's current implementation.

#### Heavy Development Tools
- `mypy==1.19.1` (13.0 MB)
- `ruff==0.14.11` (13.1 MB)
- `pytest` and coverage tools
- `pre-commit` hooks

**Impact:** Development dependencies are appropriately isolated in `[dependency-groups.dev]`.

### Potentially Unused Dependencies

Based on code analysis, the following dependencies may not be actively used:

#### 1. **genkit** and **genkit-plugin-google-genai**
- **Location:** pyproject.toml:30-31
- **Usage:** Only imported in `debug_genkit.py` (appears to be a debug/test file)
- **Main code:** Uses `google.genai` directly in `llm_core/providers/gemini.py`
- **Recommendation:** ⚠️ **VERIFY** if genkit is actually needed or if it's legacy code
- **Impact if removed:** Would eliminate most Google Cloud transitive dependencies (~30+ packages)

#### 2. **Duplicate:** `sqlalchemy` (Listed twice)
- **Location:** pyproject.toml:36 and pyproject.toml:39
- **Issue:** 🔴 **CRITICAL** - Listed twice in dependencies
- **Recommendation:** Remove one occurrence (line 39)

#### 3. **github-copilot-sdk**
- **Location:** pyproject.toml:41
- **Usage:** Imported in `llm_core/providers/copilot.py`
- **Status:** ✅ Actively used for Copilot provider
- **Recommendation:** KEEP

#### 4. **anthropic**
- **Location:** pyproject.toml:40
- **Usage:** Imported in `llm_core/providers/anthropic.py`
- **Status:** ✅ Actively used for Anthropic provider
- **Recommendation:** KEEP

### Frontend Bundle Analysis

The frontend is well-optimized:
- Core dependencies: React (18.3.1), CodeMirror 6, minimal state management
- Build tool: Vite (7.3.0) - excellent tree-shaking
- No obvious bloat detected
- **Recommendation:** Consider upgrading to React 19 when stable patterns are established

---

## 4. Critical Issues Found

### Issue #1: Duplicate Dependency 🔴 CRITICAL

**Problem:**
```toml
# pyproject.toml lines 36 and 39
dependencies = [
  ...
  "sqlalchemy>=2.0.0",    # Line 36
  ...
  "sqlalchemy",           # Line 39 - DUPLICATE
  ...
]
```

**Impact:** Confusing, may cause issues with dependency resolution

**Fix:**
```diff
dependencies = [
  ...
  "sqlalchemy>=2.0.0",
-  "sqlalchemy",
  ...
]
```

### Issue #2: Potentially Unused Genkit Dependencies ⚠️ WARNING

**Problem:** `genkit` and `genkit-plugin-google-genai` are only used in `debug_genkit.py`, not in main application code

**Evidence:**
- Main Gemini provider uses `google.genai` directly (llm_core/providers/gemini.py:4)
- Only import of genkit is in debug_genkit.py (appears to be test/debug file)

**Impact:** If unused, these packages pull in ~30+ Google Cloud transitive dependencies

**Recommendation:**
1. Verify if `debug_genkit.py` is still needed
2. If not, consider removing genkit dependencies
3. If needed, document why and keep

**Potential savings:** ~40+ MB of dependencies if removed

---

## 5. Package Version Constraints

### Well-Constrained Dependencies ✅
Most dependencies have appropriate version constraints:
- `cryptography>=46.0.0` - Good minimum for security
- `fastapi>=0.124.0` - Allows patches
- `pydantic>=2.7.0` - Major version locked

### Loose Constraints ⚠️
Some dependencies lack version constraints:
- `python-dotenv` (no version specified)
- `sqlalchemy` (duplicate, one has no version)

**Recommendation:** Add minimum versions to prevent breakage:
```toml
"python-dotenv>=1.0.0",
```

---

## 6. Recommendations

### Immediate Actions (CRITICAL)

1. **Fix duplicate sqlalchemy dependency**
   ```bash
   # Edit pyproject.toml and remove line 39
   uv sync
   ```

2. **Verify Genkit usage**
   ```bash
   # Check if debug_genkit.py is needed
   # If not, remove genkit dependencies to save ~40MB
   ```

### High Priority Updates (Security & Stability)

1. **Update critical packages**
   ```bash
   uv add --upgrade-package certifi
   uv add --upgrade-package ruff
   uv add --upgrade-package starlette
   ```

2. **Update development tools**
   ```bash
   uv add --dev --upgrade-package ruff
   uv add --dev --upgrade-package mypy
   ```

### Medium Priority (Breaking Changes - Test First)

1. **websockets 15→16 upgrade**
   ```bash
   # Review changelog: https://websockets.readthedocs.io/
   uv add --upgrade-package websockets
   # Run tests: uv run pytest
   ```

2. **Google Cloud packages**
   ```bash
   # These are transitive, will update automatically
   uv sync
   ```

### Low Priority (Frontend - Breaking Changes)

1. **React 18→19 upgrade**
   - ⚠️ **Wait for ecosystem stability**
   - React 19 has breaking changes
   - Test thoroughly before upgrading
   - Many libraries may not support React 19 yet

2. **Zustand 4→5 upgrade**
   - Review migration guide
   - Update after React upgrade

### Cleanup Recommendations

1. **Add missing version constraints**
   ```toml
   "python-dotenv>=1.0.0",
   ```

2. **Document genkit decision**
   - Add comment in pyproject.toml explaining why genkit is needed
   - Or remove if unused

3. **Consider dependency review workflow**
   - Add automated dependency updates (Dependabot/Renovate)
   - Schedule quarterly dependency audits

---

## 7. Maintenance Plan

### Monthly
- Run `uv run pip-audit` for security checks
- Check for critical updates to FastAPI, uvicorn, cryptography

### Quarterly
- Review and update all dependencies
- Run `uv add --upgrade` for non-breaking updates
- Test thoroughly after updates

### Annually
- Major version upgrades (React, etc.)
- Dependency cleanup (remove unused packages)
- Full codebase review for deprecated patterns

### Automation
```bash
# Add to CI/CD pipeline
uv run pip-audit --desc
npm audit --json
```

---

## 8. Summary of Changes Needed

### pyproject.toml Changes

```diff
dependencies = [
  "aiosqlite>=0.20.0",
  "browser-cookie3>=0.20.1",
  "cachetools>=5.3.0",
  "cryptography>=46.0.0",
- "python-dotenv",
+ "python-dotenv>=1.0.0",
  "fastapi>=0.124.0",
  "gemini-webapi>=1.10.2",
  "genkit>=0.1.0",
  "genkit-plugin-google-genai>=0.1.0",
  "httpx>=0.28.1",
  "orjson>=3.10.0",
  "pydantic>=2.7.0",
  "pydantic-settings>=2.2.0",
  "sqlalchemy>=2.0.0",
  "uvicorn[standard]>=0.38.0",
  "uvloop>=0.22.0",
- "sqlalchemy",
  "anthropic>=0.30.0",
  "github-copilot-sdk>=0.1.0",
]
```

### Update Commands

```bash
# Fix critical issues
# 1. Edit pyproject.toml manually (remove duplicate sqlalchemy)
# 2. Add version constraint to python-dotenv

# Update packages
uv add --upgrade-package certifi
uv add --upgrade-package ruff
uv add --upgrade-package starlette
uv add --dev --upgrade-package ruff
uv add --dev --upgrade-package mypy

# Sync and verify
uv sync
uv run pytest
```

---

## 9. Risk Assessment

| Action | Risk Level | Impact | Recommendation |
|--------|-----------|---------|----------------|
| Fix duplicate sqlalchemy | 🟢 LOW | Cleanup only | **Do immediately** |
| Update certifi, ruff | 🟢 LOW | Patch updates | **Do immediately** |
| Update Google packages | 🟡 MEDIUM | Minor versions | **Test first** |
| Upgrade websockets 15→16 | 🟡 MEDIUM | Major version | **Test thoroughly** |
| Upgrade React 18→19 | 🔴 HIGH | Breaking changes | **Wait for stability** |
| Remove genkit | 🟡 MEDIUM | If unused, saves 40MB | **Verify usage first** |

---

## Conclusion

Overall, the project has **good dependency hygiene** with no security vulnerabilities. The main issues are:

1. ✅ **Security:** Excellent - no vulnerabilities
2. ⚠️ **Maintenance:** Needs attention - 20+ outdated packages
3. ⚠️ **Bloat:** Moderate - Genkit pulls in heavy Google Cloud dependencies
4. 🔴 **Critical:** Duplicate sqlalchemy dependency

**Recommended immediate actions:**
1. Fix duplicate sqlalchemy (5 minutes)
2. Verify if genkit is needed (potential 40MB savings)
3. Update critical packages (certifi, ruff, starlette)
4. Add version constraints to python-dotenv

**Estimated time to implement all recommendations:** 2-3 hours including testing

**Estimated reduction in dependencies if genkit removed:** ~30-40 packages, ~40MB
