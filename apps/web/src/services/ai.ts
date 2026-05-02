import { API_BASE } from '../constants/api';
import { type HealedResponse, healJSON } from '../utils/jsonHealer';

export class AIImageError extends Error {
  status: number;
  statusText: string;
  body: string;
  constructor(message: string, status: number, statusText: string, body: string) {
    super(message);
    this.name = 'AIImageError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

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

  async transformFile(instruction: string, currentContent: string): Promise<string> {
    const systemPrompt = `You rewrite the whole file based on the instruction. Return ONLY the full updated file with no explanations. Support Chinese text properly and preserve Chinese characters, formatting, and encoding.`;

    const userPrompt = `Instruction: ${instruction}

Current file content:
---START FILE---
${currentContent}
---END FILE---

Note: Preserve proper character encoding and formatting for all text content.`;

    try {
      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
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
          ...this.providerFields(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from AI');
      }

      let content = data.choices[0].message.content.trim();

      // Clean up common AI response artifacts
      if (content.startsWith('---START FILE---')) {
        content = content.replace(/^---START FILE---\s*/, '');
      }
      if (content.endsWith('---END FILE---')) {
        content = content.replace(/\s*---END FILE---$/, '');
      }

      return content;
    } catch (error) {
      throw new Error(`Failed to transform file: ${error}`);
    }
  }

  async estimateTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }

  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? this.temperature,
          max_tokens: options?.maxTokens ?? 4000,
          ...this.providerFields(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from AI');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      throw new Error(`Failed to get chat completion: ${error}`);
    }
  }

  /**
   * Transform file with JSON response healing
   * Automatically heals malformed JSON responses from AI models
   */
  async transformFileJSON<T = any>(
    instruction: string,
    currentContent: string,
    schema?: any
  ): Promise<HealedResponse<T>> {
    const response = await this.transformFile(instruction, currentContent);
    return healJSON<T>(response, schema);
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
    try {
      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: schema ? { type: 'json_object' } : undefined,
          temperature: options?.temperature ?? this.temperature,
          max_tokens: options?.maxTokens ?? 4000,
          ...this.providerFields(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from AI');
      }

      const content = data.choices[0].message.content.trim();
      return healJSON<T>(content, schema);
    } catch (error) {
      throw new Error(`Failed to get chat completion: ${error}`);
    }
  }

  async generateImage(prompt: string, size: '256x256' | '512x512' | '1024x1024' = '1024x1024'): Promise<string> {
    if (!prompt.trim()) throw new Error('Image prompt is empty');
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          size,
          n: 1,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        // Try to extract error details from JSON if present
        let msg = text;
        try {
          const err = JSON.parse(text);
          msg = err?.error?.message || err?.message || text;
        } catch (_err) {
          // If JSON parsing fails, we fall back to the raw response text
          // which was already assigned to 'msg' above.
        }
        throw new AIImageError(
          `OpenAI Image API error: ${response.status} ${response.statusText} - ${msg}`,
          response.status,
          response.statusText,
          text
        );
      }
      const data = JSON.parse(text);
      const item = data?.data?.[0];
      if (!item) throw new Error('No image returned from AI');
      if (item.b64_json) {
        return item.b64_json;
      }
      if (item.url) {
        // Fetch the image URL and convert to base64
        const imgRes = await fetch(item.url);
        if (!imgRes.ok) {
          throw new Error(`Failed to fetch generated image URL: ${imgRes.status} ${imgRes.statusText}`);
        }
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        // Convert bytes to base64 efficiently
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < buf.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
        }
        return btoa(binary);
      }
      throw new Error('Unsupported image response format from AI');


  }
}
