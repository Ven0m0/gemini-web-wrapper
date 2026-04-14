# Helixent Implementation Plan

## Overview

Implement the Helixent agent loop architecture into the existing Affine AI Workstation monorepo. This adds ReAct-style agent capabilities with tool use, middleware, skills, and a rich frontend UI for agent interaction.

## Current State

- **Frontend** (`apps/web`): React 19 + Vite 8 PWA with chat, editor, shell, and file tools
- **Backend** (`apps/api`): FastAPI with LLM provider factory (Gemini, Anthropic, Copilot, OpenAI-compatible)
- **Shared Python**: Config, LLM core, OpenAI schemas
- **No agent loop exists** — the chat is simple request/response with no tool calling

## Architecture

The implementation follows Helixent's 3-layer architecture adapted for this monorepo:

```
packages/helixent/     ← NEW: TypeScript agent loop library (Bun/Node compatible)
├── src/
│   ├── foundation/    ← Layer 1: Core primitives (Model, Message, Tool types)
│   ├── agent/         ← Layer 2: ReAct agent loop with middleware
│   ├── coding/        ← Layer 3: Coding agent with tools and approval
│   └── community/     ← Provider adapters (OpenAI, Anthropic)
apps/api/              ← EXTENDED: New agent streaming endpoints
apps/web/              ← EXTENDED: New agent chat UI component
```

## Implementation Waves

### Wave 1: Foundation Package (Independent)
Create `packages/helixent/` with the core TypeScript types and primitives.

**Files:**
- `packages/helixent/package.json` — Package config with zod, openai, @anthropic-ai/sdk deps
- `packages/helixent/tsconfig.json` — TypeScript config
- `packages/helixent/src/foundation/messages/types/role.ts` — Role type
- `packages/helixent/src/foundation/messages/types/content.ts` — Content types (Text, Image, Thinking, ToolUse, ToolResult)
- `packages/helixent/src/foundation/messages/types/message.ts` — Message types (System, User, Assistant, Tool)
- `packages/helixent/src/foundation/messages/index.ts` — Barrel export
- `packages/helixent/src/foundation/models/model-provider.ts` — ModelProvider interface
- `packages/helixent/src/foundation/models/model-context.ts` — ModelContext interface
- `packages/helixent/src/foundation/models/model.ts` — Model class
- `packages/helixent/src/foundation/models/index.ts` — Barrel export
- `packages/helixent/src/foundation/tools/function-tool.ts` — FunctionTool + defineTool
- `packages/helixent/src/foundation/tools/structured-tool-result.ts` — StructuredToolResult
- `packages/helixent/src/foundation/tools/index.ts` — Barrel export
- `packages/helixent/src/foundation/index.ts` — Barrel export

### Wave 2: Agent Loop (Depends on Wave 1)
Implement the ReAct agent loop and middleware system.

**Files:**
- `packages/helixent/src/agent/agent-event.ts` — AgentEvent types
- `packages/helixent/src/agent/agent-middleware.ts` — Middleware hooks interface
- `packages/helixent/src/agent/agent.ts` — Core Agent class with think/act loop
- `packages/helixent/src/agent/tool-result-runtime.ts` — Tool result formatting
- `packages/helixent/src/agent/index.ts` — Barrel export

### Wave 3: Community Providers + Skills + Coding Agent (Depends on Wave 2)
Provider adapters, skills middleware, and coding agent layer.

**Files:**
- `packages/helixent/src/community/openai/utils.ts` — OpenAI message/tool conversion
- `packages/helixent/src/community/openai/stream-utils.ts` — OpenAI stream accumulator
- `packages/helixent/src/community/openai/model-provider.ts` — OpenAIModelProvider
- `packages/helixent/src/community/openai/index.ts` — Barrel export
- `packages/helixent/src/community/anthropic/utils.ts` — Anthropic message/tool conversion
- `packages/helixent/src/community/anthropic/stream-utils.ts` — Anthropic stream accumulator
- `packages/helixent/src/community/anthropic/model-provider.ts` — AnthropicModelProvider
- `packages/helixent/src/community/anthropic/index.ts` — Barrel export
- `packages/helixent/src/agent/skills/types.ts` — SkillFrontmatter type
- `packages/helixent/src/agent/skills/skill-reader.ts` — Skill file reader
- `packages/helixent/src/agent/skills/skills-middleware.ts` — Skills middleware
- `packages/helixent/src/agent/todos/types.ts` — Todo types
- `packages/helixent/src/agent/todos/todos.ts` — Todo system + middleware
- `packages/helixent/src/coding/tools/tool-result.ts` — Tool result helpers
- `packages/helixent/src/coding/tools/tool-utils.ts` — Path/truncation helpers
- `packages/helixent/src/coding/tools/bash.ts` — Bash tool
- `packages/helixent/src/coding/tools/read-file.ts` — Read file tool
- `packages/helixent/src/coding/tools/write-file.ts` — Write file tool
- `packages/helixent/src/coding/tools/str-replace.ts` — String replace tool
- `packages/helixent/src/coding/tools/list-files.ts` — List files tool
- `packages/helixent/src/coding/tools/glob-search.ts` — Glob search tool
- `packages/helixent/src/coding/tools/grep-search.ts` — Grep search tool
- `packages/helixent/src/coding/tools/apply-patch.ts` — Apply patch tool
- `packages/helixent/src/coding/tools/file-info.ts` — File info tool
- `packages/helixent/src/coding/tools/mkdir.ts` — Mkdir tool
- `packages/helixent/src/coding/tools/move-path.ts` — Move path tool
- `packages/helixent/src/coding/permissions/approval-types.ts` — Approval types
- `packages/helixent/src/coding/permissions/requires-approval.ts` — Tools requiring approval
- `packages/helixent/src/coding/permissions/approval-manager.ts` — Approval queue manager
- `packages/helixent/src/coding/permissions/approval-middleware.ts` — Approval middleware
- `packages/helixent/src/coding/agents/lead-agent.ts` — createCodingAgent factory
- `packages/helixent/src/coding/index.ts` — Barrel export
- `packages/helixent/src/index.ts` — Main barrel export

### Wave 4: Backend Agent API (Depends on Wave 3)
New FastAPI endpoints that bridge the frontend to the agent loop via SSE streaming.

**Files to modify:**
- `apps/api/src/affine/api/server.py` — Add agent streaming endpoint
- `packages/shared/python/src/affine/shared/models.py` — Add agent-related models
- `packages/shared/python/src/affine/shared/openai_schemas.py` — Add agent request schemas

**New files:**
- `apps/api/src/affine/api/agent.py` — Agent SSE endpoint and tool execution bridge
- `packages/shared/python/src/affine/shared/agent_schemas.py` — Agent request/response schemas

### Wave 5: Frontend Agent UI (Depends on Wave 4)
New React components for agent interaction with tool visualization.

**New files:**
- `apps/web/src/services/agent.ts` — Agent streaming service (SSE client)
- `apps/web/src/components/AgentChat.tsx` — Agent chat component with tool visualization
- `apps/web/src/components/ToolCallCard.tsx` — Tool call/result display component
- `apps/web/src/components/ApprovalDialog.tsx` — Human-in-the-loop approval UI

**Files to modify:**
- `apps/web/src/store.ts` — Add agent state (tool calls, approval queue, session)
- `apps/web/src/App.tsx` — Add 'agent' mode
- `apps/web/src/components/ConfigOverlay.tsx` — Add agent settings

### Wave 6: Session Persistence + Token Tracking (Depends on Wave 5)

**New files:**
- `apps/web/src/services/sessionStore.ts` — IndexedDB-based session persistence
- `packages/helixent/src/agent/session.ts` — Session serialization utilities

**Files to modify:**
- `apps/web/src/store.ts` — Add session state
- `apps/web/src/components/AgentChat.tsx` — Add session management

## Feature Enhancements Beyond Helixent

These are improvements identified during analysis:

1. **Enhanced Error Recovery**: Retry logic with exponential backoff for transient provider errors
2. **Token Budget System**: Track and display token usage per-conversation with budget limits
3. **Session Persistence**: File-based + IndexedDB sessions for resuming conversations
4. **Parallel Tool Execution Visualization**: Show concurrent tool calls with progress indicators
5. **Agent Mode Toggle**: Switch between simple chat and full agent mode in the UI
6. **Tool Result Streaming**: Stream large tool outputs (like file reads) progressively
7. **Configurable Middleware Pipeline**: UI for enabling/disabling middleware at runtime
8. **Conversation Branching**: Fork conversations from any point and explore alternatives

## Validation

After each wave:
```bash
# TypeScript
cd packages/helixent && bun install && bun run typecheck

# Python
cd apps/api && uv sync --all-extras && uv run ruff check && uv run pytest

# Frontend
cd apps/web && bun install && bun run lint && bun run typecheck && bun run build
```
