import type { Message, } from "../messages";
import type { ModelContext } from "./model-context";
import type { ModelProvider, ModelProviderInvokeParams } from "./model-provider";

/**
 * Represents a model that can be used to generate text.
 */
export class Model {
  constructor(
    readonly name: string,
    readonly provider: ModelProvider,
    readonly options?: Record<string, unknown>,
  ) {}

  invoke(context: ModelContext) {
    const params = this._buildModelProviderParams(context);
    return this.provider.invoke(params);
  }

  stream(context: ModelContext) {
    const params = this._buildModelProviderParams(context);
    return this.provider.stream(params);
  }

  private _buildModelProviderParams(context: ModelContext): ModelProviderInvokeParams {
    const messages: Message[] = [];
    if (context.prompt) {
      messages.push({ role: "system", content: [{ type: "text", text: context.prompt }] });
    }
    messages.push(...context.messages);
    return {
      model: this.name,
      options: this.options,
      messages,
      tools: context.tools,
      signal: context.signal,
    };
  }
}
