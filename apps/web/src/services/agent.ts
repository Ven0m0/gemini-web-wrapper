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
import { generateId } from '../utils/id';

const CURRENT_ID = 'a-current';

function updateCurrent(messages: AgentMessage[], update: (current: AgentMessage) => AgentMessage): AgentMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant' && last.id === CURRENT_ID) {
    return [...messages.slice(0, -1), update(last)];
  }
  const fresh: AgentMessage = { id: CURRENT_ID, role: 'assistant', content: '', timestamp: Date.now() };
  return [...messages, update(fresh)];
}

/** Gives the in-progress assistant message a unique id so later turns never share the streaming id. */
export function finalizeCurrent(messages: AgentMessage[]): AgentMessage[] {
  if (!messages.some((m) => m.id === CURRENT_ID)) return messages;
  return messages.map((m) => (m.id === CURRENT_ID ? { ...m, id: `a-${generateId()}` } : m));
}

/** Pure reducer folding one streamed agent event into the message list. */
export function reduceAgentEvent(messages: AgentMessage[], event: AgentEvent): AgentMessage[] {
  switch (event.type) {
    case 'text_delta':
      if (!event.text) return messages;
      return updateCurrent(messages, (m) => ({ ...m, content: m.content + event.text }));
    case 'thinking_delta':
      if (!event.thinking) return messages;
      return updateCurrent(messages, (m) => ({ ...m, thinking: (m.thinking ?? '') + event.thinking }));
    case 'tool_call':
      return updateCurrent(messages, (m) => ({
        ...m,
        toolCalls: [
          ...(m.toolCalls ?? []),
          { id: event.tool_id ?? '', name: event.tool_name ?? '', args: event.arguments ?? {} },
        ],
      }));
    case 'tool_result':
      return messages.map((m) =>
        m.toolCalls?.some((tc) => tc.id === event.tool_id)
          ? {
              ...m,
              toolCalls: m.toolCalls.map((tc) => (tc.id === event.tool_id ? { ...tc, result: event.result } : tc)),
            }
          : m
      );
    case 'done':
      return finalizeCurrent(messages);
    default:
      return messages;
  }
}

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
