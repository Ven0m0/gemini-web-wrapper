---
name: mcp-development
description: Build Model Context Protocol (MCP) servers with tools, resources, and prompts. Use when creating MCP servers, choosing stdio vs HTTP transport, debugging MCP behavior, or implementing MCP patterns in Python or TypeScript.
allowed-tools: "Bash, Read, Write, Edit, Glob, Grep"
---

# MCP Development

Build and debug Model Context Protocol (MCP) servers in Python and TypeScript.

<instructions>

## Workflow

Think through MCP server design step-by-step:

1. **Define scope**: What tools/resources/prompts does the server need?
2. **Choose transport**: stdio (local, single-user) or HTTP (web, multi-user)?
3. **Design schemas**: Input/output schemas for each tool, URI templates for resources
4. **Implement**: Tool logic with validation, error handling, structured output
5. **Test**: MCP Inspector for interactive testing, unit tests for logic
6. **Deploy**: Configure for target environment (Claude Desktop, web app, CLI)

## Transport Decision

| Use Case              | Transport        | Why                          |
| --------------------- | ---------------- | ---------------------------- |
| Claude Desktop        | stdio            | Native support, simple setup |
| Web application       | HTTP             | Browser-compatible           |
| High-scale deployment | HTTP (stateless) | Horizontal scaling           |
| Local CLI tool        | stdio            | Pipes, process communication |
| Multi-user service    | HTTP             | Session management, CORS     |
| Development/testing   | stdio            | Easier debugging             |

</instructions>

<core_concepts>

## Tools

Functions the LLM can call. Define: input schema, validation, structured output, clear description.

## Resources

Data the LLM can read. Types: static (fixed URI) or dynamic (URI template with parameters). Include MIME type.

## Prompts

Reusable templates with arguments. Return formatted prompt text.

## Context

Shared capabilities: logging (stderr only), progress reporting, sampling (LLM generation), elicitation (user input).

</core_concepts>

<patterns>

## Tool Definition Pattern

1. Define input schema with validation rules
2. Write a clear description (what it does AND when to use it)
3. Implement logic with error handling
4. Return structured output (human-readable + machine-readable)
5. Never leak internal errors to the LLM

## Dynamic Resource Pattern

1. Define URI template: `resource://type/{id}`
2. Parse and validate URI parameters
3. Fetch/compute content
4. Return with appropriate MIME type
5. Handle missing resources gracefully (don't crash)

## Error Handling

- Catch errors in tools; return error objects, don't crash the server
- Provide clear error messages with context
- Log errors to stderr with tool name and parameters
- Use structured logging in production

</patterns>

<language_specific>

## Python (FastMCP)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
async def search_docs(query: str, limit: int = 10) -> list[dict]:
    """Search documentation by keyword. Use when the user asks about API usage."""
    results = await doc_index.search(query, limit=limit)
    return [{"title": r.title, "url": r.url, "snippet": r.snippet} for r in results]

@mcp.resource("docs://{topic}")
async def get_doc(topic: str) -> str:
    """Get documentation for a specific topic."""
    return await doc_index.get(topic)
```

- Use Pydantic for schema validation
- All I/O must be async
- Log to stderr (stdout is the protocol channel)

## TypeScript

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

server.tool("search_docs", { query: z.string(), limit: z.number().default(10) }, async ({ query, limit }) => {
  const results = await docIndex.search(query, limit);
  return { content: [{ type: "text", text: JSON.stringify(results) }] };
});
```

- Use Zod for runtime validation
- ES modules required
- Handle transport cleanup on disconnect

</language_specific>

<debugging>

| Problem                   | Likely Cause                          | Fix                                        |
| ------------------------- | ------------------------------------- | ------------------------------------------ |
| Schema validation fails   | Type mismatch, missing required field | Check Pydantic/Zod schema vs input         |
| Tools not appearing       | Registration error                    | Verify decorator/method call, check logs   |
| Transport errors          | Malformed JSON-RPC                    | Validate message format, check stderr logs |
| Async errors              | Blocking I/O                          | Ensure all I/O uses async/await            |
| stdout corruption (stdio) | Logging to stdout                     | Redirect all logs to stderr                |

</debugging>

<security>
- Validate all tool inputs (sanitize file paths, prevent directory traversal)
- Never hardcode secrets; use environment variables
- Implement auth for production HTTP servers
- Rate-limit expensive operations
- Restrict file access to allowed directories
- Check file sizes before reading
</security>

<examples>

### Complete Python MCP server

```python
from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("weather")

@mcp.tool()
async def get_weather(city: str) -> dict:
    """Get current weather for a city. Use when the user asks about weather conditions."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.weather.example/v1/{city}")
        resp.raise_for_status()
        data = resp.json()
    return {"city": city, "temp_f": data["temp"], "condition": data["condition"]}

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Testing with MCP Inspector

```bash
# Interactive testing
npx @modelcontextprotocol/inspector python -m my_server

# Manual stdio test
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | python -m my_server
```

</examples>

## Success Criteria

MCP server is complete when:

- All tools/resources return correct results for valid inputs
- Schema validation rejects invalid inputs with clear messages
- Errors are handled gracefully (server never crashes on bad input)
- Tests pass (unit for logic, integration for full workflow)
- LLM can discover and correctly use all tools
- Logging is sufficient to debug issues in production
