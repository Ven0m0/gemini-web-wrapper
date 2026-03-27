import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, ChatMessage } from '../interfaces';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generate(
    prompt: string,
    options?: { system?: string; history?: ChatMessage[] }
  ): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: options?.system,
    });

    const history = this.buildHistory(options?.history);
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(prompt);
    
    return result.response.text() ?? '';
  }

  async *stream(
    prompt: string,
    options?: { system?: string; history?: ChatMessage[] }
  ): AsyncGenerator<string> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: options?.system,
    });

    const history = this.buildHistory(options?.history);
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  private buildHistory(history?: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    if (!history) return [];
    
    return history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));
  }
}
