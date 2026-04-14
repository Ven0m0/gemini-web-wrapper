import type { AssistantMessage, Message, Tool } from "../messages";

export interface ModelProviderInvokeParams {
  model: string;
  messages: Message[];
  tools?: Tool[];
  options?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * A provider for a model. Implementations wrap specific LLM APIs
 * (OpenAI, Anthropic, etc.) and handle message conversion and streaming.
 */
export interface ModelProvider {
  invoke(params: ModelProviderInvokeParams): Promise<AssistantMessage>;
  stream(params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage>;
}
