import type {
  Message, AssistantMessage, ToolUseContent, TextContent, ThinkingContent,
  ToolResultContent, UserMessage, SystemMessage, TokenUsage,
} from "@/foundation";

export function convertToOpenAIMessages(messages: Message[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      const sys = message as SystemMessage;
      result.push({ role: "system", content: sys.content.map((c) => c.text).join("\n") });
    } else if (message.role === "user") {
      const user = message as UserMessage;
      if (user.content.length === 1 && user.content[0]?.type === "text") {
        result.push({ role: "user", content: user.content[0].text });
      } else {
        result.push({
          role: "user",
          content: user.content.map((c) => {
            if (c.type === "text") return { type: "text", text: c.text };
            if (c.type === "image_url") return { type: "image_url", image_url: c.image_url };
            return null;
          }).filter(Boolean),
        });
      }
    } else if (message.role === "assistant") {
      const asst = message as AssistantMessage;
      const toolCalls = asst.content
        .filter((c): c is ToolUseContent => c.type === "tool_use")
        .map((c) => ({
          type: "function" as const,
          id: c.id,
          function: { name: c.name, arguments: JSON.stringify(c.input) },
        }));
      const textParts = asst.content
        .filter((c): c is TextContent => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      const entry: Record<string, unknown> = { role: "assistant" };
      if (textParts) entry.content = textParts;
      if (toolCalls.length > 0) entry.tool_calls = toolCalls;
      if (!textParts && toolCalls.length === 0) entry.content = null;
      result.push(entry);
    } else if (message.role === "tool") {
      const toolMsg = message as { role: "tool"; content: ToolResultContent[] };
      for (const tr of toolMsg.content) {
        result.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
      }
    }
  }
  return result;
}

export function convertToOpenAITools(tools: Array<{ name: string; description: string; parameters: { _def?: { shape?: Record<string, unknown> } } }>): Record<string, unknown>[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters._def?.shape ? { type: "object", properties: tool.parameters._def.shape } : {},
    },
  }));
}

export function parseAssistantMessage(
  choice: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> | null },
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
): AssistantMessage {
  const content: (TextContent | ThinkingContent | ToolUseContent)[] = [];
  if (choice.content) content.push({ type: "text", text: choice.content });
  if (choice.tool_calls) {
    for (const tc of choice.tool_calls) {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.function.arguments); } catch { input = { raw: tc.function.arguments }; }
      content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
    }
  }
  const tokenUsage: TokenUsage | undefined = usage ? {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  } : undefined;
  return { role: "assistant", content, ...(tokenUsage ? { usage: tokenUsage } : {}) };
}
