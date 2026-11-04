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

  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it('updateFile PUTs UTF-8 content as base64 with the sha and returns the new sha', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: { sha: 'new-sha' } }));

    const sha = await new GitHubService('tok', 'o', 'r').updateFile('a.txt', 'héllo', 'old-sha', 'msg', 'dev');

    expect(sha).toBe('new-sha');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/repos/o/r/contents/a.txt');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    const body = sentBody();
    expect(body).toEqual({ message: 'msg', content: btoa(String.fromCharCode(...new TextEncoder().encode('héllo'))), branch: 'dev', sha: 'old-sha' });
  });

  it('updateFile omits sha for new files', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: { sha: 's' } }));
    await new GitHubService('tok', 'o', 'r').updateFile('a.txt', 'x', '  ', 'msg');
    expect('sha' in sentBody()).toBe(false);
  });

  it('updateFile wraps HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse('no', { ok: false, status: 409, statusText: 'Conflict' }));
    await expect(new GitHubService('tok', 'o', 'r').updateFile('a.txt', 'x', 's', 'm')).rejects.toThrow(
      /Failed to commit file/
    );
  });

  it('updateFileBase64 sends content unchanged and returns sha and download_url', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: { sha: 'bin-sha', download_url: 'https://dl/x.png' } }));

    const result = await new GitHubService('tok', 'o', 'r').updateFileBase64('x.png', 'QUJD', '', 'msg');

    expect(result).toEqual({ sha: 'bin-sha', download_url: 'https://dl/x.png' });
    expect(sentBody()).toEqual({ message: 'msg', content: 'QUJD', branch: 'main' });
  });

  it('updateFileBase64 wraps HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse('no', { ok: false, status: 422, statusText: 'Unprocessable' }));
    await expect(new GitHubService('tok', 'o', 'r').updateFileBase64('x.png', 'QUJD', '', 'm')).rejects.toThrow(
      /Failed to commit binary file/
    );
  });

  it('listDirectory maps a directory listing and a single-file response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { name: 'src', path: 'src', type: 'dir', sha: 's1' },
        { name: 'a.ts', path: 'a.ts', type: 'file', size: 3, sha: 's2' },
      ])
    );
    const svc = new GitHubService('tok', 'o', 'r');
    expect(await svc.listDirectory('')).toEqual([
      { name: 'src', path: 'src', type: 'dir', size: undefined, sha: 's1' },
      { name: 'a.ts', path: 'a.ts', type: 'file', size: 3, sha: 's2' },
    ]);

    fetchMock.mockResolvedValueOnce(jsonResponse({ name: 'b.ts', path: 'b.ts', type: 'file', size: 9, sha: 's3' }));
    expect(await svc.listDirectory('b.ts')).toEqual([{ name: 'b.ts', path: 'b.ts', type: 'file', size: 9, sha: 's3' }]);
  });
});
