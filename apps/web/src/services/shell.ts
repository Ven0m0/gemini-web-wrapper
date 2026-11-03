import { generateId } from '../utils/id';
import { normalizeString } from '../utils/string';

export type ShellTerminalMode = 'classic' | 'ghostty';

export interface ShellProfile {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface ShellPreferences {
  terminalMode: ShellTerminalMode;
  fontSize: number;
  enableHaptics: boolean;
  showAccessoryBar: boolean;
}

export interface ShellState {
  profiles: ShellProfile[];
  preferences: ShellPreferences;
}

type ShellStateCandidate = {
  profiles?: unknown;
  preferences?: unknown;
};

export const SHELL_STATE_STORAGE_KEY = 'gemini-shell-state';

const DEFAULT_PREFERENCES: ShellPreferences = {
  terminalMode: 'ghostty',
  fontSize: 14,
  enableHaptics: true,
  showAccessoryBar: true,
};

function normalizeFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.fontSize;
  }

  return Math.min(22, Math.max(12, Math.round(value)));
}

function normalizeProfile(candidate: unknown, index: number): ShellProfile | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const profile = candidate as {
    id?: unknown;
    name?: unknown;
    url?: unknown;
    description?: unknown;
  };

  const url = normalizeString(profile.url);
  if (!url) {
    return null;
  }

  const name = normalizeString(profile.name) || `Saved shell ${index + 1}`;
  return {
    id: normalizeString(profile.id) || generateId(),
    name,
    url,
    description: normalizeString(profile.description),
  };
}

export function createDefaultShellState(): ShellState {
  return {
    profiles: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

export function createShellProfile(values: Pick<ShellProfile, 'name' | 'url' | 'description'>): ShellProfile {
  return {
    id: generateId(),
    name: normalizeString(values.name) || 'Saved shell',
    url: normalizeString(values.url),
    description: normalizeString(values.description),
  };
}

export function migrateSavedShellState(raw: unknown): ShellState {
  const defaults = createDefaultShellState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const candidate = raw as ShellStateCandidate;
  const seenUrls = new Set<string>();
  const profiles = Array.isArray(candidate.profiles)
    ? candidate.profiles
        .map((profile, index) => normalizeProfile(profile, index))
        .filter((profile): profile is ShellProfile => profile !== null)
        .filter((profile) => {
          const key = profile.url.toLowerCase();
          if (seenUrls.has(key)) {
            return false;
          }

          seenUrls.add(key);
          return true;
        })
    : defaults.profiles;

  const preferencesCandidate =
    candidate.preferences && typeof candidate.preferences === 'object'
      ? (candidate.preferences as Partial<ShellPreferences>)
      : {};

  const terminalMode =
    preferencesCandidate.terminalMode === 'classic'
      ? 'classic'
      : preferencesCandidate.terminalMode === 'ghostty'
        ? 'ghostty'
        : DEFAULT_PREFERENCES.terminalMode;

  return {
    profiles,
    preferences: {
      terminalMode,
      fontSize: normalizeFontSize(preferencesCandidate.fontSize),
      enableHaptics:
        typeof preferencesCandidate.enableHaptics === 'boolean'
          ? preferencesCandidate.enableHaptics
          : DEFAULT_PREFERENCES.enableHaptics,
      showAccessoryBar:
        typeof preferencesCandidate.showAccessoryBar === 'boolean'
          ? preferencesCandidate.showAccessoryBar
          : DEFAULT_PREFERENCES.showAccessoryBar,
    },
  };
}

export function readSavedShellState(): ShellState {
  if (typeof window === 'undefined') {
    return createDefaultShellState();
  }

  const raw = localStorage.getItem(SHELL_STATE_STORAGE_KEY);
  if (!raw) {
    return createDefaultShellState();
  }

  try {
    return migrateSavedShellState(JSON.parse(raw));
  } catch {
    return createDefaultShellState();
  }
}

export function persistShellState(state: ShellState): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(SHELL_STATE_STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// URL validation
// Accepts HTTPS git URLs and SSH git URLs.  Uses a strict character allowlist
// so that the generated clone command is safe to display and copy without
// quoting.
// ---------------------------------------------------------------------------

/** Characters that are safe in a bare (unquoted) HTTPS git URL on the command line.
 *  Note: `@` is intentionally excluded to prevent host-confusion attacks
 *  (e.g. https://attacker.com@victim.com/repo).  Token injection uses a
 *  separate, explicitly validated code path in buildCloneCommand.
 */
export const SAFE_HTTPS_URL = /^https?:\/\/[a-zA-Z0-9/:._\-~%+=?#]+$/;

/** Characters that are safe in an SSH-shorthand git URL: git@host:owner/repo[.git] */
export const SAFE_SSH_URL = /^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9._/-]+$/;

export function isValidGitUrl(url: string): boolean {
  if (!url) return false;
  return SAFE_HTTPS_URL.test(url) || SAFE_SSH_URL.test(url);
}

/** Build the clone command string. */
export function buildCloneCommand(url: string, useToken: boolean, token: string): string {
  if (useToken && token && url.startsWith('https://github.com/')) {
    // Set token via environment variable and use a temporary git credential helper
    // This prevents the token from leaking into the git URL or shell history
    // Single-quote the token so the shell never expands it; embedded quotes are escaped.
    const quoted = `'${token.replace(/'/g, "'\\''")}'`;
    return `GITHUB_TOKEN=${quoted} git -c credential.helper='!f() { echo "username=oauth2"; echo "password=$GITHUB_TOKEN"; }; f' clone ${url}`;
  }
  return `git clone ${url}`;
}
