import Anthropic from "@anthropic-ai/sdk";
import type { AssistantMessage, ModelProvider, ModelProviderInvokeParams, TokenUsage } from "@/foundation";

function extractSystemPrompt(messages: any[]): string | undefined {
  const parts: string[] = [];
  for (const m of messages) { if (m.role === "system") parts.push(m.content.map((c: any) => c.text).join("\n")); }
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export class AnthropicModelProvider implements ModelProvider {
  _client: Anthropic;
  constructor({ baseURL, apiKey }: { baseURL?: string; apiKey?: string } = {}) {
    const isDefault = !baseURL || baseURL === "https://api.anthropic.com";
    this._client = new Anthropic({ ...(isDefault ? {} : { baseURL }), apiKey });
  }
  async invoke(params: ModelProviderInvokeParams): Promise<AssistantMessage> {
    const system = extractSystemPrompt(params.messages);
    const anthropicMessages = params.messages.filter((m) => m.role !== "system").map((m) => {
      if (m.role === "user") return { role: "user", content: m.content.map((c: any) => c.type === "text" ? { type: "text", text: c.text } : null).filter(Boolean) };
      if (m.role === "assistant") return { role: "assistant", content: m.content.map((c: any) => c.type === "tool_use" ? { type: "tool_use", id: c.id, name: c.name, input: c.input } : c.type === "thinking" ? { type: "thinking", thinking: c.thinking } : { type: "text", text: c.text }) };
      if (m.role === "tool") return { role: "user", content: m.content.map((c: any) => ({ type: "tool_result", tool_use_id: c.tool_use_id, content: c.content })) };
      return null;
    }).filter(Boolean);
    const anthropicTools = (params.tools as any[] | undefined)?.map((t: any) => ({ name: t.name, description: t.description, input_schema: { type: "object" as const, properties: t.parameters ?? {} } }));
    const response = await this._client.messages.create({ model: params.model, max_tokens: 8192, messages: anthropicMessages as any, ...(system ? { system } : {}), ...(anthropicTools ? { tools: anthropicTools as any } : {}), ...params.options } as Anthropic.MessageCreateParamsNonStreaming, { signal: params.signal });
    const content: any[] = [];
    for (const block of response.content as any[]) {
      if (block.type === "text") content.push({ type: "text", text: block.text });
      else if (block.type === "thinking") content.push({ type: "thinking", thinking: block.thinking });
      else if (block.type === "tool_use") content.push({ type: "tool_use", id: block.id, name: block.name, input: block.input });
    }
    const usage: TokenUsage | undefined = response.usage ? { promptTokens: response.usage.input_tokens ?? 0, completionTokens: response.usage.output_tokens ?? 0, totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0) } : undefined;
    return { role: "assistant", content: content.length > 0 ? content : [{ type: "text", text: "" }], ...(usage ? { usage } : {}) };
  }
  async *stream(params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage> {
    const msg = await this.invoke(params);
    yield { ...msg, streaming: true };
    yield { ...msg, streaming: false };
  }
}
