import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoIndexService } from './repoIndex';

function response(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('RepoIndexService.getStatus', () => {
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

  it('returns the status on success and sends the bearer token', async () => {
    const status = { owner: 'o', repo: 'r', branch: 'main', status: 'indexed' };
    fetchMock.mockResolvedValueOnce(response(status));

    await expect(new RepoIndexService('key').getStatus('o', 'r', 'main')).resolves.toEqual(status);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('owner=o&repo=r&branch=main');
    expect(init.headers.Authorization).toBe('Bearer key');
  });

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(response('missing', 404, 'Not Found'));
    await expect(new RepoIndexService('key').getStatus('o', 'r', 'main')).resolves.toBeNull();
  });

  it('rethrows other HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(response('bad', 500, 'Server Error'));
    await expect(new RepoIndexService('key').getStatus('o', 'r', 'main')).rejects.toThrow(/500/);
  });
});
