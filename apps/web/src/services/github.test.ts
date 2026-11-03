import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubService } from './github';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('GitHubService', () => {
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

  it('createBranch reads object.sha from the ref response and posts a new ref', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ref: 'refs/heads/main', object: { sha: 'abc123' } }))
      .mockResolvedValueOnce(jsonResponse({}));

    await new GitHubService('tok', 'o', 'r').createBranch('feature', 'main');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/repos/o/r/git/ref/heads/main');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api.github.com/repos/o/r/git/refs');
    expect(JSON.parse(init.body)).toEqual({ ref: 'refs/heads/feature', sha: 'abc123' });
  });

  it('createBranch wraps HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse('nope', { ok: false, status: 404, statusText: 'Not Found' }));
    await expect(new GitHubService('tok', 'o', 'r').createBranch('x')).rejects.toThrow(/Failed to create branch/);
  });

  it('getFile decodes base64 content as UTF-8', async () => {
    const text = 'héllo wörld';
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: b64, sha: 'sha1' }));

    const file = await new GitHubService('tok', 'o', 'decode-repo').getFile('a.txt', 'main', true);

    expect(file).toEqual({ content: text, sha: 'sha1' });
  });

  it('getFile wraps HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse('boom', { ok: false, status: 500, statusText: 'Server Error' }));
    await expect(new GitHubService('tok', 'o', 'err-repo').getFile('a.txt', 'main', true)).rejects.toThrow(
      /Failed to fetch file/
    );
  });
});
