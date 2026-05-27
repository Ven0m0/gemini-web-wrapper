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

  it('loadConfig handles malicious or unexpected data safely', () => {
    // Prototype pollution attempt
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({
        owner: 'attack-owner',
        '__proto__': { 'polluted': true },
        'constructor': { 'prototype': { 'polluted': true } }
      })
    );
    // Unexpected types
    vi.mocked(sessionStorage.getItem).mockReturnValue(
      JSON.stringify({
        temperature: 'hot', // should be number
        githubToken: 12345, // should be string
        providers: 'not-an-array' // should be array
      })
    );

    const initialConfig = {
      owner: 'initial-owner',
      temperature: 0.3,
      githubToken: 'initial-token',
      providers: []
    } as any as ConfigState;

    const loaded = loadConfig(initialConfig);

    // Should ignore invalid types and retain initial/default values
    expect(loaded.owner).toBe('attack-owner'); // Valid string field is merged
    expect(loaded.temperature).toBe(0.3); // Invalid type 'hot' is ignored
    expect(loaded.githubToken).toBe('initial-token'); // Invalid type 12345 is ignored

    // Prototype should not be polluted
    expect((loaded as any).polluted).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();

    // providers should remain an array (or default from migrateSavedConfig)
    expect(Array.isArray(loaded.providers)).toBe(true);
  });

  it('clearStorage removes data from both storages', () => {
    clearStorage();
    expect(localStorage.removeItem).toHaveBeenCalledWith('chat-github-config');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('chat-github-config');
  });
});
