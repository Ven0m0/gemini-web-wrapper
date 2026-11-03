import { API_BASE } from '../constants/api';
import { requestJson } from './http';
import { type HealedResponse, healJSON } from '../utils/jsonHealer';

/**
 * AI Service - Wired to local API endpoints
 *
 * All requests go through the local API server which handles:
 * - Provider routing (Gemini, Anthropic, Copilot, Bifrost)
 * - Authentication (API keys, cookie auth)
 * - Rate limiting and quotas
 *
 * The local API is accessed via /v1/chat/completions (proxied by Vite dev server)
 * and production deployments serve the API directly.
 */
export class AIService {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private provider: string | undefined;
  private providerKey: string | undefined;
  private providerBaseUrl: string | undefined;

  constructor(
    apiKey: string,
    model: string = 'gemini-3.1-pro-preview',
    temperature: number = 0.3,
    provider?: string,
    providerKey?: string,
    providerBaseUrl?: string
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.temperature = temperature;
    this.provider = provider;
    this.providerKey = providerKey;
    this.providerBaseUrl = providerBaseUrl;
  }

  /**
   * Get headers for API requests.
   * Sends the server gateway key (openaiKey) in Authorization if present.
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Extra request-body fields for user-supplied provider keys.
   * Only included when both provider and providerKey are non-empty.
   */
  private providerFields(): Record<string, string> {
    if (this.provider && (this.providerKey || this.providerBaseUrl)) {
      return {
        x_provider: this.provider,
        ...(this.providerKey ? { x_provider_api_key: this.providerKey } : {}),
        ...(this.providerBaseUrl ? { x_provider_base_url: this.providerBaseUrl } : {}),
      };
    }
    return {};
  }

  private async postCompletion(body: Record<string, unknown>): Promise<string> {
    const data = await requestJson<{ choices?: Array<{ message: { content: string } }> }>(
      `${API_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ model: this.model, ...body, ...this.providerFields() }),
      }
    );
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from AI');
    }
    return data.choices[0].message.content.trim();
  }

  async transformFile(instruction: string, currentContent: string): Promise<string> {
    const systemPrompt = `You rewrite the whole file based on the instruction. Return ONLY the full updated file with no explanations. Support Chinese text properly and preserve Chinese characters, formatting, and encoding.`;

    const userPrompt = `Instruction: ${instruction}

Current file content:
---START FILE---
${currentContent}
---END FILE---

Note: Preserve proper character encoding and formatting for all text content.`;

    let content = await this.postCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...(this.model === 'gpt-5'
        ? {
            max_completion_tokens: 4000,
            // GPT-5 only supports default temperature (1.0)
          }
        : {
            temperature: this.temperature,
            max_tokens: 4000,
          }),
    });

    // Clean up common AI response artifacts
    if (content.startsWith('---START FILE---')) {
      content = content.replace(/^---START FILE---\s*/, '');
    }
    if (content.endsWith('---END FILE---')) {
      content = content.replace(/\s*---END FILE---$/, '');
    }

    return content;
  }

  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: string };
    }
  ): Promise<string> {
    return this.postCompletion({
      messages,
      response_format: options?.responseFormat,
      temperature: options?.temperature ?? this.temperature,
      max_tokens: options?.maxTokens ?? 4000,
    });
  }

  /**
   * Chat completion with JSON response healing
   */
  async chatCompletionJSON<T = any>(
    messages: Array<{ role: string; content: string }>,
    schema?: any,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<HealedResponse<T>> {
    const content = await this.chatCompletion(messages, {
      ...options,
      responseFormat: schema ? { type: 'json_object' } : undefined,
    });
    return healJSON<T>(content, schema);
  }
}
