import { describe, expect, it } from 'vitest';

import {
  buildCloneCommand,
  createShellProfile,
  isValidGitUrl,
  migrateSavedShellState,
  SAFE_HTTPS_URL,
  SAFE_SSH_URL,
} from './shell';

describe('shell service', () => {
  it('normalizes stored shell state and applies defaults', () => {
    const state = migrateSavedShellState({
      profiles: [
        { name: 'Primary', url: 'ws://localhost:8080', description: 'Dev shell' },
        { name: 'Duplicate', url: 'ws://localhost:8080' },
        { url: 'ws://localhost:9090' },
        { name: 'Missing URL' },
      ],
      preferences: {
        terminalMode: 'ghostty',
        fontSize: 40,
        enableHaptics: false,
      },
    });

    expect(state.preferences).toEqual({
      fontSize: 22,
      enableHaptics: false,
      showAccessoryBar: true,
    });
    expect(state.profiles).toHaveLength(2);
    expect(state.profiles[0]?.name).toBe('Primary');
    expect(state.profiles[1]?.name).toBe('Saved shell 3');
  });

  it('creates a trimmed shell profile', () => {
    const profile = createShellProfile({
      name: '  My shell  ',
      url: '  ws://localhost:8000  ',
      description: '  main repo  ',
    });

    expect(profile.name).toBe('My shell');
    expect(profile.url).toBe('ws://localhost:8000');
    expect(profile.description).toBe('main repo');
    expect(profile.id.length).toBeGreaterThan(0);
  });
});

describe('git clone helpers', () => {
  it('accepts safe https and ssh urls', () => {
    expect(SAFE_HTTPS_URL.test('https://github.com/owner/repo.git')).toBe(true);
    expect(SAFE_SSH_URL.test('git@github.com:owner/repo.git')).toBe(true);
    expect(isValidGitUrl('https://github.com/owner/repo')).toBe(true);
    expect(isValidGitUrl('git@github.com:owner/repo')).toBe(true);
  });

  it('rejects empty, host-confusion, and shell-metacharacter urls', () => {
    expect(isValidGitUrl('')).toBe(false);
    expect(isValidGitUrl('https://attacker.com@victim.com/repo')).toBe(false);
    expect(isValidGitUrl('https://github.com/a/b; rm -rf /')).toBe(false);
    expect(isValidGitUrl('https://github.com/a/b$(id)')).toBe(false);
    expect(isValidGitUrl('git@github.com:a/b`id`')).toBe(false);
    expect(isValidGitUrl('ftp://github.com/a/b')).toBe(false);
  });

  it('builds a plain clone command without a token', () => {
    expect(buildCloneCommand('https://github.com/a/b', false, 'tok')).toBe('git clone https://github.com/a/b');
    expect(buildCloneCommand('https://example.com/a/b', true, 'tok')).toBe('git clone https://example.com/a/b');
    expect(buildCloneCommand('https://github.com/a/b', true, '')).toBe('git clone https://github.com/a/b');
  });

  it('single-quotes the token and escapes embedded quotes', () => {
    const cmd = buildCloneCommand('https://github.com/a/b', true, 'ghp_abc');
    // Leading space keeps the line out of shell history under HISTCONTROL=ignorespace.
    expect(cmd.startsWith(" GITHUB_TOKEN='ghp_abc' git -c credential.https://github.com.helper=")).toBe(true);
    expect(cmd.endsWith('clone https://github.com/a/b')).toBe(true);
    // Helper is scoped to github.com so a redirect target never receives the token.
    expect(cmd).toContain('-c credential.https://github.com.helper= -c credential.https://github.com.helper=');
    expect(cmd).not.toContain(' -c credential.helper=');
    expect(cmd).toContain('username=x-access-token');
    expect(cmd).not.toContain('oauth2');

    const hostile = buildCloneCommand('https://github.com/a/b', true, "x'; touch /tmp/pwn; '$(id)");
    expect(hostile.startsWith(" GITHUB_TOKEN='x'\\''; touch /tmp/pwn; '\\''$(id)' git")).toBe(true);
  });

  it('adds a safe branch and drops unsafe ones', () => {
    expect(buildCloneCommand('https://github.com/a/b', false, '', 'feat/x-1.2_y')).toBe(
      'git clone --branch feat/x-1.2_y https://github.com/a/b',
    );
    expect(buildCloneCommand('https://github.com/a/b', true, 'tok', 'main')).toContain(' clone --branch main https://');
    expect(buildCloneCommand('https://github.com/a/b', false, '', '')).toBe('git clone https://github.com/a/b');
    for (const bad of ['--upload-pack=evil', '-x', 'a b', 'a;id', '$(id)', 'a`id`']) {
      expect(buildCloneCommand('https://github.com/a/b', false, '', bad)).toBe('git clone https://github.com/a/b');
    }
  });
});
