import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AgentService, AgentEvent } from './agent';
import { API_BASE } from '../constants/api';

describe('AgentService', () => {
  const mockApiKey = 'test-api-key';
  const defaultParams = {
    model: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
    // Suppress console.warn for tests to avoid cluttering output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function createMockReader(chunks: string[]) {
    let index = 0;
    const encoder = new TextEncoder();
    return {
      read: vi.fn().mockImplementation(() => {
        if (index >= chunks.length) {
          return Promise.resolve({ done: true, value: undefined });
        }
        return Promise.resolve({
          done: false,
          value: encoder.encode(chunks[index++]),
        });
      }),
      releaseLock: vi.fn(),
    };
  }

  function mockFetchResponse(ok: boolean, status: number, statusText: string, bodyReader?: ReadableStreamDefaultReader<Uint8Array> | null) {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok,
      status,
      statusText,
      body: bodyReader ? { getReader: () => bodyReader } : null,
    });
  }

  it('constructs the request correctly with all parameters', async () => {
    const reader = createMockReader(['data: [DONE]\n\n']);
    mockFetchResponse(true, 200, 'OK', reader);

    const service = new AgentService(mockApiKey);
    const params = {
      ...defaultParams,
      systemPrompt: 'test system prompt',
      provider: 'test-provider',
      providerKey: 'test-provider-key',
      providerBaseUrl: 'https://test-url.com',
    };

    const generator = service.stream(params);
    await generator.next();

    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mockApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        system_prompt: params.systemPrompt,
        x_provider: params.provider,
        x_provider_api_key: params.providerKey,
        x_provider_base_url: params.providerBaseUrl,
      }),
    });
  });

  it('yields valid AgentEvents from SSE stream', async () => {
    const event1: AgentEvent = { type: 'text_delta', text: 'Hello' };
    const event2: AgentEvent = { type: 'text_delta', text: ' World' };

    const chunks = [
      `data: ${JSON.stringify(event1)}\n\n`,
      `data: ${JSON.stringify(event2)}\n\n`,
      'data: [DONE]\n\n'
    ];

    const reader = createMockReader(chunks);
    mockFetchResponse(true, 200, 'OK', reader);

    const service = new AgentService(mockApiKey);
    const events: AgentEvent[] = [];

    for await (const event of service.stream(defaultParams)) {
      events.push(event);
    }

    expect(events).toEqual([event1, event2]);
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  it('handles partial/split chunks correctly across multiple reads', async () => {
    const event: AgentEvent = { type: 'text_delta', text: 'split chunk test' };
    const eventJson = JSON.stringify(event);

    // Split the JSON string into two chunks to simulate network fragmentation
    const chunk1 = `data: ${eventJson.slice(0, 15)}`;
    const chunk2 = `${eventJson.slice(15)}\n\n`;

    const reader = createMockReader([chunk1, chunk2, 'data: [DONE]\n\n']);
    mockFetchResponse(true, 200, 'OK', reader);

    const service = new AgentService(mockApiKey);
    const events: AgentEvent[] = [];

    for await (const event of service.stream(defaultParams)) {
      events.push(event);
    }

    expect(events).toEqual([event]);
  });

  it('throws an error if response.ok is false', async () => {
    mockFetchResponse(false, 401, 'Unauthorized');

    const service = new AgentService(mockApiKey);
    const generator = service.stream(defaultParams);

    await expect(generator.next()).rejects.toThrow('Agent API error: 401 Unauthorized');
  });

  it('throws an error if response body is null or getReader is missing', async () => {
    mockFetchResponse(true, 200, 'OK', null); // No reader

    const service = new AgentService(mockApiKey);
    const generator = service.stream(defaultParams);

    await expect(generator.next()).rejects.toThrow('No response body');
  });

  it('gracefully handles invalid JSON and continues', async () => {
    const validEvent: AgentEvent = { type: 'text_delta', text: 'Valid' };

    const chunks = [
      'data: { invalid json }\n\n',
      `data: ${JSON.stringify(validEvent)}\n\n`,
      'data: [DONE]\n\n'
    ];

    const reader = createMockReader(chunks);
    mockFetchResponse(true, 200, 'OK', reader);

    const service = new AgentService(mockApiKey);
    const events: AgentEvent[] = [];

    for await (const event of service.stream(defaultParams)) {
      events.push(event);
    }

    expect(console.warn).toHaveBeenCalled();
    expect(events).toEqual([validEvent]);
  });

  it('stops streaming and returns when encountering "done" event', async () => {
    const event1: AgentEvent = { type: 'text_delta', text: 'Hello' };
    const doneEvent: AgentEvent = { type: 'done' };
    const eventAfterDone: AgentEvent = { type: 'text_delta', text: 'Should not yield' };

    const chunks = [
      `data: ${JSON.stringify(event1)}\n\n`,
      `data: ${JSON.stringify(doneEvent)}\n\n`,
      `data: ${JSON.stringify(eventAfterDone)}\n\n`
    ];

    const reader = createMockReader(chunks);
    mockFetchResponse(true, 200, 'OK', reader);

    const service = new AgentService(mockApiKey);
    const events: AgentEvent[] = [];

    for await (const event of service.stream(defaultParams)) {
      events.push(event);
    }

    expect(events).toEqual([event1, doneEvent]);
  });

  it('stops streaming and returns when encountering "error" event', async () => {
    const event1: AgentEvent = { type: 'text_delta', text: 'Hello' };
    const errorEvent: AgentEvent = { type: 'error', error: 'Something went wrong' };
    const eventAfterError: AgentEvent = { type: 'text_delta', text: 'Should not yield' };

    const chunks = [
      `data: ${JSON.stringify(event1)}\n\n`,
      `data: ${JSON.stringify(errorEvent)}\n\n`,
      `data: ${JSON.stringify(eventAfterError)}\n\n`
    ];

    const reader = createMockReader(chunks);
    mockFetchResponse(true, 200, 'OK', reader);

    const service = new AgentService(mockApiKey);
    const events: AgentEvent[] = [];

    for await (const event of service.stream(defaultParams)) {
      events.push(event);
    }

    expect(events).toEqual([event1, errorEvent]);
  });
});
