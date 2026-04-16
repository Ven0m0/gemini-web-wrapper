import type { AssistantMessage, TextContent, ThinkingContent, ToolUseContent, TokenUsage } from "@/foundation";

interface ToolCallAccumulator { id: string; name: string; arguments: string; }

export class StreamAccumulator {
  private _text = "";
  private _thinking = "";
  private _toolCalls: Map<number, ToolCallAccumulator> = new Map();
  private _usage: TokenUsage | undefined;

  push(chunk: { choices?: Array<{ delta?: { content?: string | null; reasoning_content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }): void {
    // Always capture usage metadata, even on usage-only chunks with no choices/delta
    if (chunk.usage) {
      this._usage = { promptTokens: chunk.usage.prompt_tokens ?? 0, completionTokens: chunk.usage.completion_tokens ?? 0, totalTokens: chunk.usage.total_tokens ?? 0 };
    }
    const choice = chunk.choices?.[0];
    if (!choice?.delta) return;
    const delta = choice.delta;
    if (delta.content) this._text += delta.content;
    if (delta.reasoning_content) this._thinking += delta.reasoning_content;
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const index = tc.index ?? 0;
        const existing = this._toolCalls.get(index);
        if (existing) {
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          if (tc.id) existing.id = tc.id;
        } else {
          this._toolCalls.set(index, { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: tc.function?.arguments ?? "" });
        }
      }
    }
  }

  snapshot(): AssistantMessage {
    const content: (TextContent | ThinkingContent | ToolUseContent)[] = [];
    if (this._thinking) content.push({ type: "thinking", thinking: this._thinking });
    if (this._text) content.push({ type: "text", text: this._text });
    const sortedKeys = [...this._toolCalls.keys()].sort((a, b) => a - b);
    for (const key of sortedKeys) {
      const tc = this._toolCalls.get(key)!;
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.arguments); } catch { input = { __raw: tc.arguments }; }
      content.push({ type: "tool_use", id: tc.id, name: tc.name, input });
    }
    return { role: "assistant", content: content.length > 0 ? content : [{ type: "text", text: "" }], streaming: true, ...(this._usage ? { usage: this._usage } : {}) };
  }
}
