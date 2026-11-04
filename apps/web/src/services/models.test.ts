import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canFetchProviderModels, describeModelError, fetchProviderModels } from './models';
import type { ProviderConfig } from './providers';

function response(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function provider(overrides: Partial<ProviderConfig>): ProviderConfig {
  return { id: 'gemini', name: 'Gemini', apiKey: '', baseUrl: '', models: [], builtin: true, ...overrides };
}

describe('fetchProviderModels', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts provider override fields and returns the model list', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: [{ id: 'm1', name: 'Model 1' }] }));

    await expect(fetchProviderModels('server-key', provider({ apiKey: 'user-key' }))).resolves.toEqual([
      { id: 'm1', name: 'Model 1' },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/models');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer server-key');
    expect(JSON.parse(init.body)).toEqual({ x_provider: 'gemini', x_provider_api_key: 'user-key' });
  });

  it('sends only the provider id when no key or base URL is set', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: [] }));

    await fetchProviderModels('server-key', provider({}));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ x_provider: 'gemini' });
  });

  it('rethrows HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: 'upstream' }, 502, 'Bad Gateway'));
    await expect(fetchProviderModels('server-key', provider({ apiKey: 'k' }))).rejects.toThrow(/502/);
  });
});

describe('describeModelError', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function failWith(body: unknown, status: number) {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(response(body, status, 'Bad Gateway')) as never;
    return fetchProviderModels('server-key', provider({})).catch((error: unknown) => error);
  }

  it('prefers the backend detail text', async () => {
    expect(describeModelError(await failWith({ detail: 'No API key' }, 400))).toBe('No API key');
  });

  it('falls back to the raw message for non-JSON or non-string detail', async () => {
    expect(describeModelError(await failWith('oops', 502))).toBe('502 Bad Gateway: oops');
    expect(describeModelError(await failWith({ detail: [{ msg: 'x' }] }, 422))).toMatch(/^422/);
    expect(describeModelError('nope')).toBe('Failed to load models');
  });
});

describe('canFetchProviderModels', () => {
  it('allows builtin providers and custom providers with a base URL', () => {
    expect(canFetchProviderModels(provider({}))).toBe(true);
    expect(canFetchProviderModels(provider({ id: 'opencode-zen', baseUrl: 'https://proxy' }))).toBe(true);
    expect(canFetchProviderModels(provider({ id: 'custom', builtin: false, apiKey: 'k' }))).toBe(false);
    expect(canFetchProviderModels(provider({ id: 'custom', builtin: false, baseUrl: 'https://api' }))).toBe(true);
  });
});
