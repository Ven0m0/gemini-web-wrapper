export interface LLMProvider {
  generate(
    prompt: string,
    options?: {
      system?: string;
      history?: Array<{ role: string; content: string }>;
    }
  ): Promise<string>;
  
  stream(
    prompt: string,
    options?: {
      system?: string;
      history?: Array<{ role: string; content: string }>;
    }
  ): AsyncGenerator<string>;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export type ProviderType = 'gemini' | 'anthropic' | 'copilot' | 'bifrost';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string;
  modelName?: string;
  bifrostUrl?: string;
  bifrostApiKey?: string;
}
