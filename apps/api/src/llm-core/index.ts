import type { LLMProvider, ProviderType, ProviderConfig } from './interfaces';
import { GeminiProvider } from './providers/gemini';
import { AnthropicProvider } from './providers/anthropic';
import { CopilotProvider } from './providers/copilot';
import { BifrostProvider } from './providers/bifrost';

export { GeminiProvider } from './providers/gemini';
export { AnthropicProvider } from './providers/anthropic';
export { CopilotProvider } from './providers/copilot';
export { BifrostProvider } from './providers/bifrost';
export type { LLMProvider, ProviderType, ProviderConfig } from './interfaces';

export class ProviderFactory {
  static create(config: ProviderConfig): LLMProvider {
    switch (config.provider) {
      case 'gemini': {
        if (!config.apiKey) {
          throw new Error('API key required for Gemini provider');
        }
        return new GeminiProvider(config.apiKey, config.modelName || 'gemini-2.5-flash');
      }
      
      case 'anthropic': {
        if (!config.apiKey) {
          throw new Error('API key required for Anthropic provider');
        }
        return new AnthropicProvider(config.apiKey, config.modelName || 'claude-3-5-sonnet-20241022');
      }
      
      case 'copilot': {
        if (!config.apiKey) {
          throw new Error('Token required for Copilot provider');
        }
        return new CopilotProvider({ token: config.apiKey, model: config.modelName });
      }
      
      case 'bifrost': {
        const url: string = config.bifrostUrl ?? 'http://localhost:8080/v1';
        const apiKey: string = config.bifrostApiKey ?? 'sk-bifrost-default';
        return new BifrostProvider({ url, apiKey, model: config.modelName });
      }
      
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
