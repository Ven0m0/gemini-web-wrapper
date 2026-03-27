import type { LLMProvider, ChatMessage } from '../interfaces';

export interface BifrostConfig {
  url: string;
  apiKey: string;
  model?: string;
}

export class BifrostProvider implements LLMProvider {
  private url: string;
  private apiKey: string;
  private model: string;

  constructor(config: BifrostConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4';
  }

  async generate(
    prompt: string,
    options?: { system?: string; history?: ChatMessage[] }
  ): Promise<string> {
    const messages = this.buildMessages(prompt, options?.history, options?.system);
    
    const response = await fetch(`${this.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bifrost API error: ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message?: { content?: string } }> };
    return data.choices[0]?.message?.content || '';
  }

  async *stream(
    prompt: string,
    options?: { system?: string; history?: ChatMessage[] }
  ): AsyncGenerator<string> {
    const messages = this.buildMessages(prompt, options?.history, options?.system);
    
    const response = await fetch(`${this.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bifrost API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private buildMessages(
    prompt: string,
    history?: ChatMessage[],
    system?: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    
    if (history) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    
    messages.push({ role: 'user', content: prompt });
    return messages;
  }
}
