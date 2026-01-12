# Genkit Migration Plan

## Overview

This document outlines the plan to migrate from the heavy `genkit` + `genkit-plugin-google-genai` dependencies to a lighter-weight alternative for accessing Google's Gemini API.

## Current Status

**Date:** 2026-01-12
**Status:** Planning Phase

## Problem Statement

The project currently uses two parallel paths for Gemini API access:

1. **Genkit Path** (API key-based)
   - Dependencies: `genkit`, `genkit-plugin-google-genai`
   - Transitive dependencies: ~50 unnecessary packages including:
     - google-cloud-aiplatform
     - google-cloud-bigquery
     - google-cloud-storage
     - Pillow, shapely, numpy
   - **Size impact**: ~150-200 MB
   - **Used by**: 4 chat completion endpoints

2. **gemini-webapi Path** (Cookie-based)
   - Dependencies: `gemini-webapi`
   - Transitive dependencies: Minimal
   - **Used by**: Cookie/profile management endpoints

## Goal

Replace Genkit with a lightweight alternative (e.g., `google-genai` SDK) to:
- Reduce dependency count: 110 → ~60 packages (-45%)
- Reduce installation size: ~150-200 MB savings
- Simplify dependency tree
- Maintain all existing functionality

## Affected Endpoints

The following endpoints use `GenkitModel` (via `get_model()` dependency) and need refactoring:

### 1. POST /chat
- **File**: server.py:524
- **Function**: `chat_endpoint()`
- **Usage**: `response = await run_in_thread(model.generate, full_prompt)`

### 2. POST /chat/stream
- **File**: server.py:551
- **Function**: `chat_stream_endpoint()`
- **Usage**: `response = await run_in_thread(model.generate, full_prompt)`

### 3. POST /chatbot
- **File**: server.py:599
- **Function**: `chatbot_endpoint()`
- **Usage**: Via genkit flow (complex)

### 4. POST /chatbot/stream
- **File**: server.py:627
- **Function**: `chatbot_stream_endpoint()`
- **Usage**: Via genkit flow (complex)

## Migration Options

### Option A: google-genai SDK (Recommended)

**Pros:**
- Official Google SDK
- Minimal dependencies
- Direct API access
- Well-documented

**Cons:**
- Requires refactoring
- Different API patterns

**Installation:**
```bash
uv remove genkit genkit-plugin-google-genai
uv add google-genai
```

### Option B: Use gemini-webapi for All Endpoints

**Pros:**
- Already installed
- Already working for cookie-based endpoints
- Can support API key authentication

**Cons:**
- Primarily designed for cookie-based access
- May not have full feature parity with official SDK

### Option C: Keep Genkit, File Feature Request

**Pros:**
- No code changes needed
- Wait for upstream fix

**Cons:**
- No timeline for fix
- Bloat remains indefinitely

## Recommended Approach: Option A

Use `google-genai` SDK for API key-based endpoints.

## Implementation Steps

### Phase 1: Research & POC (2-4 hours)

1. **Create POC branch**
   ```bash
   git checkout -b poc/google-genai-migration
   ```

2. **Install google-genai**
   ```bash
   uv add google-genai
   ```

3. **Create wrapper class**
   - Create `google_genai_client.py`
   - Implement wrapper matching `GenkitModel` protocol
   - Test basic generation

4. **Test one endpoint**
   - Modify `/chat` endpoint to use new client
   - Verify functionality
   - Compare response format

### Phase 2: Full Migration (4-6 hours)

5. **Refactor all endpoints**
   - Update `/chat`
   - Update `/chat/stream`
   - Update `/chatbot`
   - Update `/chatbot/stream`

6. **Update dependency injection**
   - Modify `get_model()` function
   - Update `AppState` dataclass
   - Update `lifespan()` function

7. **Remove Genkit code**
   - Delete `create_chatbot_flow()` function
   - Remove Genkit imports
   - Remove genkit dependencies
   ```bash
   uv remove genkit genkit-plugin-google-genai
   ```

### Phase 3: Testing (2-3 hours)

8. **Run test suite**
   ```bash
   uv run pytest test_server.py -v
   ```

9. **Manual testing**
   - Test each endpoint with curl
   - Verify streaming works
   - Test error handling
   - Verify response format compatibility

10. **Load testing**
    - Ensure performance is maintained or improved

### Phase 4: Documentation & Deployment (1-2 hours)

11. **Update documentation**
    - Update README.md
    - Update API documentation
    - Update environment variable docs

12. **Create PR**
    - Document breaking changes (if any)
    - Include before/after dependency comparison
    - Add migration notes

## Code Changes Required

### New File: `google_genai_client.py`

```python
"""Google Generative AI client wrapper."""

from typing import Protocol
from google import genai


class GoogleGenAIClient:
    """Wrapper for google-genai SDK matching GenkitModel protocol."""

    def __init__(self, api_key: str, model_name: str):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def generate(self, messages: str | list[dict[str, str]]) -> "GenerateResponse":
        """Generate response matching Genkit interface."""
        # Convert messages to google-genai format
        prompt = self._convert_messages(messages)

        # Call google-genai
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )

        return GenerateResponse(text=response.text)

    def _convert_messages(self, messages):
        """Convert OpenAI-style messages to google-genai format."""
        # Implementation needed
        pass


class GenerateResponse:
    """Response object matching Genkit interface."""

    def __init__(self, text: str):
        self._text = text

    @property
    def text(self) -> str:
        return self._text
```

### Modified: `server.py`

```python
# Remove:
# from genkit.ai import Genkit
# from genkit.plugins.google_genai import GoogleAI

# Add:
from google_genai_client import GoogleGenAIClient

# Update lifespan:
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ...

    # Replace Genkit initialization with:
    state.model = GoogleGenAIClient(
        api_key=settings.google_api_key,
        model_name=model_path,
    )

    # Remove: create_chatbot_flow(state.genkit)

    # ...
```

## Testing Checklist

- [ ] `/chat` endpoint returns correct format
- [ ] `/chat/stream` streams correctly
- [ ] `/chatbot` handles history correctly
- [ ] `/chatbot/stream` streams with history
- [ ] Error handling works correctly
- [ ] OpenAI compatibility maintained
- [ ] All 22 existing tests pass
- [ ] No regression in performance
- [ ] Docker build succeeds
- [ ] Docker image size reduced

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Python packages | 110 | ~60 | `uv tree \| wc -l` |
| Installation size | ~300 MB | ~150 MB | `du -sh .venv` |
| Docker image size | TBD | -30% | `docker images` |
| `uv sync` time | TBD | -30% | Time measurement |
| Test pass rate | 22/22 | 22/22 | `pytest` |

## Risk Assessment

**Risk Level:** Medium

**Risks:**
1. Breaking API compatibility
2. Different error handling patterns
3. Performance degradation
4. Feature gaps in google-genai SDK

**Mitigations:**
1. POC phase validates feasibility first
2. Protocol pattern allows gradual migration
3. Comprehensive test suite catches regressions
4. Can roll back to Genkit if needed

## Timeline Estimate

- **POC**: 2-4 hours
- **Full Migration**: 4-6 hours
- **Testing**: 2-3 hours
- **Documentation**: 1-2 hours
- **Total**: 9-15 hours

## Next Steps

1. Assign owner/developer
2. Schedule time for POC work
3. Create POC branch
4. Begin Phase 1 (Research & POC)
5. Review POC results before proceeding

## References

- [Google Gen AI SDK Documentation](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
- [google-genai Python Package](https://pypi.org/project/google-genai/)
- [Genkit Documentation](https://genkit.dev/)
- [Dependency Audit Report](DEPENDENCY_AUDIT_2026.md)

---

**Status Updates:**

| Date | Status | Notes |
|------|--------|-------|
| 2026-01-12 | Planning | Migration plan created |

