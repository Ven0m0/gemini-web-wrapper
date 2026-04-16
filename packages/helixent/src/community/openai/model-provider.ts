import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import type { AssistantMessage, ModelProvider, ModelProviderInvokeParams } from "@/foundation";
import { StreamAccumulator } from "./stream-utils";
import { convertToOpenAIMessages, parseAssistantMessage } from "./utils";

type OpenAIToolParam = OpenAI.Chat.Completions.ChatCompletionTool;

function toOpenAITools(tools: Array<{ name: string; description: string; parameters: z.ZodSchema }>): OpenAIToolParam[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters) as Record<string, unknown>,
    },
  }));
}

export class OpenAIModelProvider implements ModelProvider {
  _client: OpenAI;
  constructor({ baseURL, apiKey }: { baseURL?: string; apiKey?: string } = {}) {
    this._client = new OpenAI({ baseURL, apiKey });
  }
  async invoke(params: ModelProviderInvokeParams): Promise<AssistantMessage> {
    const openaiTools = params.tools && params.tools.length > 0
      ? toOpenAITools(params.tools as unknown as Array<{ name: string; description: string; parameters: z.ZodSchema }>)
      : undefined;
    const response = await this._client.chat.completions.create({
      model: params.model,
      messages: convertToOpenAIMessages(params.messages) as unknown as OpenAI.ChatCompletionMessageParam[],
      ...(openaiTools ? { tools: openaiTools } : {}),
      temperature: 0,
      ...(params.options as Record<string, unknown>),
    }, { signal: params.signal });
    return parseAssistantMessage(response.choices[0]?.message ?? {}, response.usage);
  }
  async *stream(params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage> {
    const openaiTools = params.tools && params.tools.length > 0
      ? toOpenAITools(params.tools as unknown as Array<{ name: string; description: string; parameters: z.ZodSchema }>)
      : undefined;
    const response = await this._client.chat.completions.create({
      model: params.model,
      messages: convertToOpenAIMessages(params.messages) as unknown as OpenAI.ChatCompletionMessageParam[],
      ...(openaiTools ? { tools: openaiTools } : {}),
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0,
      ...(params.options as Record<string, unknown>),
    }, { signal: params.signal });
    const acc = new StreamAccumulator();
    for await (const chunk of response) { acc.push(chunk as Parameters<typeof acc.push>[0]); yield acc.snapshot(); }
  }
}
