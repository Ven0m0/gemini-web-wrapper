# Dependency Audit Report

**Date:** 2026-01-26
**Project:** Gemini Web Wrapper
**Auditor:** Claude Code
**Previous Audit:** 2026-01-25

---

## Executive Summary

**Security Status:** NO KNOWN VULNERABILITIES (CVE-2026-0994 eliminated)
**Bloat Reduction:** 4 packages removed by eliminating unused google-api-core
**Tests:** All 18 tests passing
**Frontend:** 0 vulnerabilities, build successful

---

## Changes Made

### 1. Removed Unused Python Dependencies

Successfully removed the following unused explicit dependencies:

#### Direct Dependencies Removed:
- `google-api-core>=2.29.0` - Unused in codebase, brought in protobuf with CVE-2026-0994
- `google-auth>=2.47.0` - Redundant, already transitive dependency of google-genai
- `starlette>=0.50.0` - Redundant, already transitive dependency of fastapi

#### Transitive Dependencies Removed (4 total):
- google-api-core==2.29.0
- googleapis-common-protos==1.72.0
- proto-plus==1.27.0
- protobuf==6.33.4 (CVE-2026-0994)

**Impact:** Reduced total dependencies from 99 to 95 packages (4% reduction)

---

## Security Vulnerabilities

### CVE-2026-0994 in protobuf - **ELIMINATED**

**Previous Status:** UNFIXED (no patch available)
**Current Status:** ELIMINATED by removing unused google-api-core dependency

The vulnerability existed in `google.protobuf.json_format.ParseDict()` allowing recursion depth bypass with nested `google.protobuf.Any` messages. Since google-api-core was not used anywhere in the codebase, removing it also removed protobuf and its CVE.

**Verification:**
```
$ uv run pip-audit
No known vulnerabilities found
```

---

## Current Dependency Status

### Python Dependencies (95 packages)

**Core Framework:**
- fastapi==0.128.0
- uvicorn==0.40.0
- starlette==0.50.0 (transitive via fastapi)
- pydantic==2.12.5

**LLM Providers:**
- google-genai==1.60.0
- anthropic==0.76.0
- github-copilot-sdk==0.1.18

**Security:**
- cryptography==46.0.3

**Database:**
- aiosqlite==0.22.1

**Utilities:**
- httpx==0.28.1
- orjson==3.11.5
- browser-cookie3==0.20.1
- cachetools==6.2.4

### Frontend Dependencies (450 packages)

**Core Framework:**
- react==18.3.1
- react-dom==18.3.1
- zustand==4.5.7

**Build Tools:**
- vite==7.3.0
- typescript==5.7.3

**Security:** 0 vulnerabilities

---

## Testing Results

All tests passing after dependency cleanup:

```
============================= test session starts ==============================
collected 18 items

test_server.py::test_health PASSED                                       [  5%]
test_server.py::test_chat_endpoint PASSED                                [ 11%]
test_server.py::test_chat_without_system_message PASSED                  [ 16%]
test_server.py::test_chat_missing_prompt PASSED                          [ 22%]
test_server.py::test_validation_error PASSED                             [ 27%]
test_server.py::test_code_endpoint PASSED                                [ 33%]
test_server.py::test_code_missing_instruction PASSED                     [ 38%]
test_server.py::test_code_empty_code PASSED                              [ 44%]
test_server.py::test_model_not_initialized PASSED                        [ 50%]
test_server.py::test_long_prompt_handling PASSED                         [ 55%]
test_server.py::test_special_characters_in_prompt PASSED                 [ 61%]
test_server.py::test_chatbot_endpoint_with_history PASSED                [ 66%]
test_server.py::test_chatbot_validation_empty_message PASSED             [ 72%]
test_server.py::test_chatbot_validation_missing_message PASSED           [ 77%]
test_server.py::test_chatbot_validation_invalid_role PASSED              [ 83%]
test_server.py::test_chatbot_stream_endpoint PASSED                      [ 88%]
test_server.py::test_chatbot_stream_includes_system_and_history PASSED   [ 94%]
test_server.py::test_chatbot_stream_not_initialized PASSED               [100%]

======================== 18 passed, 1 warning in 5.88s =========================
```

---

## Benefits Achieved

### Security
- Eliminated CVE-2026-0994 (protobuf DoS vulnerability)
- Zero known vulnerabilities in both Python and frontend

### Reduced Bloat
- 4 packages removed
- Removed protobuf (1.2MB) and related packages
- Cleaner dependency tree

### Code Hygiene
- Removed redundant explicit dependencies
- Dependencies now accurately reflect actual usage
- google-genai brings in google-auth transitively
- fastapi brings in starlette transitively

---

## Not Updated (Major Version Changes)

The following packages have major version updates available but were intentionally not updated:

### Python
- None requiring major version bumps

### Frontend
- react 18.3.1 → 19.2.3 (waiting for ecosystem stability)
- react-dom 18.3.1 → 19.2.3 (must be updated with React)
- zustand 4.5.7 → 5.0.10 (major API changes)
- @types/diff 5.2.3 → 7.0.2 (major version)
- @vitejs/plugin-react-swc 3.11.0 → 4.2.2 (major version)

---

## Recommendations

### Immediate
- No action required

### Short Term (Next Month)
- Monitor for React 19 ecosystem stability
- Consider Pydantic v2 migration for Settings class (ConfigDict)

### Medium Term (Next Quarter)
- React 19 migration when ecosystem is ready
- Zustand 5 migration after React 19

---

## Comparison with Previous Audit (2026-01-25)

### Issues Resolved
- CVE-2026-0994 ELIMINATED (was waiting for patch, now removed via dependency cleanup)
- Removed 3 redundant explicit dependencies

### Key Insight
The google-api-core package was explicitly declared but never used in the codebase. It was likely added during an earlier migration from genkit. Removing it also removed protobuf (which had the CVE) since nothing else required it.

---

## Conclusion

This audit successfully eliminated the CVE-2026-0994 vulnerability by removing unused dependencies rather than waiting for a patch. The project now has zero known security vulnerabilities.

**Key Achievements:**
- CVE-2026-0994 ELIMINATED
- 4 packages removed
- Zero security vulnerabilities
- All tests passing
- Frontend builds successfully

**Overall Status:** HEALTHY (no known vulnerabilities)
