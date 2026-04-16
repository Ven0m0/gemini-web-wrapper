import OpenAI from "openai";
import type { AssistantMessage, Message, ModelProvider, ModelProviderInvokeParams } from "@/foundation";
import { StreamAccumulator } from "./stream-utils";
import { convertToOpenAIMessages, parseAssistantMessage } from "./utils";

export class OpenAIModelProvider implements ModelProvider {
  _client: OpenAI;
  constructor({ baseURL, apiKey }: { baseURL?: string; apiKey?: string } = {}) {
    this._client = new OpenAI({ baseURL, apiKey });
  }
  async invoke(params: ModelProviderInvokeParams): Promise<AssistantMessage> {
    const openaiTools = (params.tools as any[] | undefined)?.map((t: any) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters ?? {} },
    }));
    const response = await this._client.chat.completions.create({
      model: params.model,
      messages: convertToOpenAIMessages(params.messages),
      ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {}),
      temperature: 0,
      ...(params.options as Record<string, unknown>),
    } as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming, { signal: params.signal });
    return parseAssistantMessage(response.choices[0]?.message ?? {}, response.usage);
  }
  async *stream(params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage> {
    const openaiTools = (params.tools as any[] | undefined)?.map((t: any) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters ?? {} },
    }));
    const response = await this._client.chat.completions.create({
      model: params.model,
      messages: convertToOpenAIMessages(params.messages),
      ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {}),
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0,
      ...(params.options as Record<string, unknown>),
    } as unknown as OpenAI.ChatCompletionCreateParamsStreaming, { signal: params.signal });
    const acc = new StreamAccumulator();
    for await (const chunk of response) { acc.push(chunk as any); yield acc.snapshot(); }
  }
}
