import type { ConfigState } from '../store';
import { migrateSavedConfig } from './providers';

const STORAGE_KEY = 'chat-github-config';

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

  let merged: any = { ...currentConfig };

  if (localRaw) {
    try {
      merged = { ...merged, ...JSON.parse(localRaw) };
    } catch {
      // ignore invalid JSON
    }
  }

  if (sessionRaw) {
    try {
      merged = { ...merged, ...JSON.parse(sessionRaw) };
    } catch {
      // ignore invalid JSON
    }
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
