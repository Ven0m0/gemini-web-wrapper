import { describe, expect, it } from "bun:test";
import { parseAssistantMessage } from "./utils";

describe("parseAssistantMessage", () => {
  it("should parse normal assistant messages with text", () => {
    const choice = {
      content: "Hello there!",
      tool_calls: null,
    };
    const result = parseAssistantMessage(choice);
    expect(result.role).toBe("assistant");
    expect(result.content).toEqual([{ type: "text", text: "Hello there!" }]);
  });

  it("should parse tool calls with valid JSON arguments", () => {
    const choice = {
      content: null,
      tool_calls: [
        {
          id: "call_123",
          function: {
            name: "get_weather",
            arguments: '{"location":"London"}',
          },
        },
      ],
    };
    const result = parseAssistantMessage(choice);
    expect(result.role).toBe("assistant");
    expect(result.content).toEqual([
      {
        type: "tool_use",
        id: "call_123",
        name: "get_weather",
        input: { location: "London" },
      },
    ]);
  });

  it("should handle malformed JSON tool arguments and return raw fallback", () => {
    const choice = {
      content: null,
      tool_calls: [
        {
          id: "call_456",
          function: {
            name: "malformed_tool",
            arguments: '{"bad json"',
          },
        },
      ],
    };
    const result = parseAssistantMessage(choice);
    expect(result.role).toBe("assistant");
    expect(result.content).toEqual([
      {
        type: "tool_use",
        id: "call_456",
        name: "malformed_tool",
        input: { raw: '{"bad json"' },
      },
    ]);
  });

  it("should include usage statistics if provided", () => {
    const choice = { content: "test" };
    const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
    const result = parseAssistantMessage(choice, usage);
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });
});
