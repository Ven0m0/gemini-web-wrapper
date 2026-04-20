export interface AgentEvent {
  type: 'tool_call' | 'tool_result' | 'text_delta' | 'thinking_delta' | 'done' | 'error';
  tool_id?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
  result?: string;
  text?: string;
  thinking?: string;
  error?: string;
  details?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown>; result?: string }>;
  thinking?: string;
}

import { API_BASE } from '../constants/api';

export class AgentService {
  constructor(private apiKey: string) {}

  async *stream(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    provider?: string;
    providerKey?: string;
    providerBaseUrl?: string;
  }): AsyncGenerator<AgentEvent> {
    const response = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        system_prompt: params.systemPrompt,
        x_provider: params.provider,
        x_provider_api_key: params.providerKey,
        x_provider_base_url: params.providerBaseUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
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
              const event: AgentEvent = JSON.parse(data);
              yield event;
              if (event.type === 'done' || event.type === 'error') return;
            } catch (e) {
              console.warn('Failed to parse SSE event:', data, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
