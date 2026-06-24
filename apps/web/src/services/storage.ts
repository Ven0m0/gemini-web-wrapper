import type { ConfigState } from '../store';
import { migrateSavedConfig, type ProviderConfig, type ProviderModelOption } from './providers';

const STORAGE_KEY = 'chat-github-config';

/**
 * Safely parses and validates configuration data from a JSON string.
 */
function safeParseConfig(raw: string | null): Partial<ConfigState> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const validated: Partial<ConfigState> = {};

    // String fields
    const stringFields: (keyof ConfigState)[] = [
      'githubToken',
      'openaiKey',
      'owner',
      'repo',
      'branch',
      'path',
      'model',
      'provider',
    ];
    for (const field of stringFields) {
      const value = (parsed as any)[field];
      if (typeof value === 'string') {
        (validated as any)[field] = value;
      }
    }

    // Number fields
    if (typeof parsed.temperature === 'number') {
      validated.temperature = parsed.temperature;
    }

    // Nested providers array
    if (Array.isArray(parsed.providers)) {
      validated.providers = parsed.providers
        .map((p: any) => {
          if (!p || typeof p !== 'object' || Array.isArray(p)) return null;

          const provider: ProviderConfig = {
            id: typeof p.id === 'string' ? p.id : '',
            name: typeof p.name === 'string' ? p.name : '',
            apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
            baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
            models: [],
            builtin: typeof p.builtin === 'boolean' ? p.builtin : undefined,
          };

          if (Array.isArray(p.models)) {
            provider.models = p.models
              .map((m: any) => {
                if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
                return {
                  id: typeof m.id === 'string' ? m.id : '',
                  name: typeof m.name === 'string' ? m.name : '',
                  uid: typeof m.uid === 'string' ? m.uid : undefined,
                } as ProviderModelOption;
              })
              .filter((m: ProviderModelOption | null): m is ProviderModelOption => m !== null && m.id !== '');
          }

          return provider.id ? provider : null;
        })
        .filter((p: ProviderConfig | null): p is ProviderConfig => p !== null);
    }

    return validated;
  } catch {
    return {};
  }
}

/**
 * Removes sensitive fields from a configuration object.
 * Currently targeted at githubToken, openaiKey, and provider API keys.
 */
export function sanitizeConfig(config: Partial<ConfigState>): Partial<ConfigState> {
  const sanitized = { ...config };

  // Remove top-level sensitive fields
  if ('githubToken' in sanitized) sanitized.githubToken = '';
  if ('openaiKey' in sanitized) sanitized.openaiKey = '';

  // Remove API keys from individual providers
  if (sanitized.providers) {
    sanitized.providers = sanitized.providers.map((p) => ({
      ...p,
      apiKey: '',
    }));
  }

  return sanitized;
}

/**
 * Persists the configuration to browser storage.
 * - Full configuration (including tokens) is stored in sessionStorage.
 * - If 'remember' is true, a sanitized version is stored in localStorage.
 */
export function saveConfig(config: Partial<ConfigState>, remember: boolean): void {
  // Always store the full config in sessionStorage for the current session persistence (reloads)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));

  if (remember) {
    // Store only the sanitized config in localStorage for cross-session remembrance of non-sensitive settings
    const sanitized = sanitizeConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Loads and merges configuration from localStorage and sessionStorage.
 * Prioritizes sessionStorage to recover sensitive tokens for the current session.
 */
export function loadConfig(currentConfig: ConfigState): ConfigState {
  const localRaw = localStorage.getItem(STORAGE_KEY);
  const sessionRaw = sessionStorage.getItem(STORAGE_KEY);

  let merged: ConfigState = { ...currentConfig };

  if (localRaw) {
    merged = { ...merged, ...safeParseConfig(localRaw) };
  }

  if (sessionRaw) {
    merged = { ...merged, ...safeParseConfig(sessionRaw) };
  }

  return migrateSavedConfig(merged);
}

/**
 * Clears saved configuration from both localStorage and sessionStorage.
 */
export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Checks if there is a configuration saved in localStorage.
 */
export function hasSavedConfig(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}
