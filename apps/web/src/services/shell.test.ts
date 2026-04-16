import { describe, expect, it } from 'vitest';

import { createShellProfile, migrateSavedShellState } from './shell';

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
        terminalMode: 'classic',
        fontSize: 40,
        enableHaptics: false,
      },
    });

    expect(state.preferences).toEqual({
      terminalMode: 'classic',
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
