import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeConfig, saveConfig, loadConfig, clearStorage } from './storage';
import { ConfigState } from '../store';

describe('storage service', () => {
  const mockConfig: Partial<ConfigState> = {
    githubToken: 'ghp_secret_token',
    openaiKey: 'sk-openai-key',
    owner: 'test-owner',
    repo: 'test-repo',
    providers: [
      {
        id: 'test-provider',
        name: 'Test Provider',
        apiKey: 'provider-secret-key',
        baseUrl: 'https://api.test.com',
        models: [{ id: 'test-model', name: 'Test Model' }],
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('sanitizes sensitive fields', () => {
    const sanitized = sanitizeConfig(mockConfig);
    expect(sanitized.githubToken).toBe('');
    expect(sanitized.openaiKey).toBe('');
    expect(sanitized.providers?.[0].apiKey).toBe('');
    expect(sanitized.owner).toBe('test-owner');
  });

  it('saveConfig stores full config in sessionStorage and sanitized in localStorage', () => {
    saveConfig(mockConfig as ConfigState, true);

    // Verify sessionStorage call (full config)
    const sessionCall = vi.mocked(sessionStorage.setItem).mock.calls[0];
    const sessionData = JSON.parse(sessionCall[1]);
    expect(sessionData.githubToken).toBe('ghp_secret_token');
    expect(sessionData.providers[0].apiKey).toBe('provider-secret-key');

    // Verify localStorage call (sanitized config)
    const localCall = vi.mocked(localStorage.setItem).mock.calls[0];
    const localData = JSON.parse(localCall[1]);
    expect(localData.githubToken).toBe('');
    expect(localData.providers[0].apiKey).toBe('');
    expect(localData.owner).toBe('test-owner');
  });

  it('loadConfig merges localStorage and sessionStorage', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({
        owner: 'test-owner',
        githubToken: '',
      })
    );
    vi.mocked(sessionStorage.getItem).mockReturnValue(
      JSON.stringify({
        githubToken: 'ghp_session_token',
      })
    );

    const loaded = loadConfig({} as ConfigState);
    expect(loaded.owner).toBe('test-owner');
    expect(loaded.githubToken).toBe('ghp_session_token');
  });

  it('clearStorage removes data from both storages', () => {
    clearStorage();
    expect(localStorage.removeItem).toHaveBeenCalledWith('chat-github-config');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('chat-github-config');
  });
});
