import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ChatMessage } from '../interfaces';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(
    prompt: string,
    options?: { system?: string; history?: ChatMessage[] }
  ): Promise<string> {
    const messages = this.buildMessages(prompt, options?.history);
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: options?.system,
      messages,
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? 'text' in textBlock ? textBlock.text : '' : '';
  }

  async *stream(
    prompt: string,
    options?: { system?: string; history?: ChatMessage[] }
  ): AsyncGenerator<string> {
    const messages = this.buildMessages(prompt, options?.history);
    
    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: options?.system,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private buildMessages(
    prompt: string,
    history?: ChatMessage[]
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (history) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    
    messages.push({ role: 'user', content: prompt });
    return messages;
  }
}
