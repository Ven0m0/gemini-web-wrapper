# Immediate Action Items - Dependency Audit

## 🔴 CRITICAL - Do Today

### 1. Fix Security Vulnerabilities (15 minutes)

```bash
# Update packages with known CVEs
uv add cryptography --upgrade-package cryptography  # 4 CVEs
uv add setuptools --upgrade-package setuptools      # 2 CVEs
uv add pip --upgrade-package pip                    # 1 CVE

# Verify no breakage
uv run pytest

# Commit
git add pyproject.toml uv.lock
git commit -m "security: Fix 7 CVEs in cryptography, setuptools, and pip"
git push
```

**Why:** Fixes 7 known security vulnerabilities including RCE risks.

---

## 🟡 HIGH PRIORITY - This Week

### 2. Fix Configuration Mismatch (30 minutes)

**Problem:** `requirements.txt` has dependencies not in `pyproject.toml`

**Solution:**

```bash
# Edit pyproject.toml to add:
# - genkit>=0.1.0
# - genkit-plugin-google-genai>=0.1.0
# - google-generativeai>=0.8.0
# - gemini-webapi>=1.10.2
# - browser-cookie3>=0.20.1
# - aiosqlite>=3.0.0

# Then sync
uv lock

# Delete requirements.txt (use pyproject.toml as single source of truth)
rm requirements.txt

# Test
uv run pytest

# Commit
git add pyproject.toml uv.lock
git commit -m "fix: Add missing dependencies to pyproject.toml"
git push
```

---

### 3. Remove Memori Bloat (2-4 hours)

**Problem:**
- 117 packages installed, ~95 are unused (from memori)
- 3+ GB of ML dependencies not used
- Current code only uses basic memori features

**Current memori usage:**
```python
# Only these 4 simple methods are used:
memori.attribution(entity_id=..., process_id=...)
memori.set_session(session_id)
memori.new_session()
memori.llm.register(model)
```

**Option A: Remove completely** ⭐ RECOMMENDED

```bash
# 1. Remove memori imports and initialization from server.py
# 2. Remove /memory/* endpoints
# 3. Implement simple dict-based session tracking if needed
# 4. Update pyproject.toml: remove "memori>=3.0.0"
# 5. Test: uv run pytest
# 6. Commit and push

# Expected result: 117 → 25 packages, 3GB+ reduction
```

**Option B: Keep and document why**

```bash
# Add to CLAUDE.md:
# "## Memori Dependency
#
# Memori adds 95+ ML/AI packages (~3GB) for future semantic memory features.
# Current usage is minimal. Consider removing if space/install time is critical."
```

---

## 📊 Expected Impact Summary

| Metric | Before | After All Fixes | Improvement |
|--------|--------|-----------------|-------------|
| Security CVEs | 7 | 0 | ✅ 100% |
| Total Packages | 117 | ~25 | 📉 78% |
| Install Size | ~4 GB | ~500 MB | 📉 87% |
| Install Time | ~5 min | ~30 sec | ⚡ 90% |
| Config Files | 2 (conflict) | 1 (clean) | ✨ Simpler |

---

## 📋 Quick Copy-Paste Commands

### Minimum (Security Only)
```bash
uv add cryptography --upgrade-package cryptography
uv add setuptools --upgrade-package setuptools
uv add pip --upgrade-package pip
uv run pytest
git add pyproject.toml uv.lock
git commit -m "security: Fix 7 CVEs in crypto/setuptools/pip"
git push
```

### Recommended (Security + Config)
```bash
# 1. Fix security
uv add cryptography --upgrade-package cryptography
uv add setuptools --upgrade-package setuptools
uv add pip --upgrade-package pip

# 2. Add missing deps to pyproject.toml (manual edit required)
# Then:
uv lock
rm requirements.txt

# 3. Test and commit
uv run pytest
git add pyproject.toml uv.lock
git commit -m "security: Fix CVEs and sync pyproject.toml"
git push
```

---

## Next Steps After Immediate Fixes

1. **Decision needed:** Keep or remove memori? (See full report)
2. **Consider:** Automated dependency scanning (Renovate/Dependabot)
3. **Document:** Add dependency policy to CLAUDE.md
4. **Monitor:** Set up monthly security audits

---

See **DEPENDENCY_AUDIT_REPORT.md** for full analysis.
