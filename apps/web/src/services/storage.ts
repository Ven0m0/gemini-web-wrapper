import { ProviderConfig } from './providers';

export interface StorageConfig {
  githubToken?: string;
  openaiKey?: string;
  providers?: ProviderConfig[];
  provider?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  model?: string;
  temperature?: number;
}

export const CONFIG_KEY = 'chat-github-config';

export function sanitizeConfig(config: StorageConfig): StorageConfig {
  const sanitized = { ...config };
  delete sanitized.githubToken;
  delete sanitized.openaiKey;

  if (sanitized.providers) {
    sanitized.providers = sanitized.providers.map((p) => ({
      ...p,
      apiKey: '',
    }));
  }
  return sanitized;
}

export function saveConfigToStorage(config: StorageConfig) {
  // Store full config including credentials in tab-scoped sessionStorage
  sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  // Persist only non-sensitive settings in localStorage
  const safeConfig = sanitizeConfig(config);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
}

export function loadConfigFromStorage(): StorageConfig | null {
  // Try to load full config from sessionStorage first (current tab)
  const sessionData = sessionStorage.getItem(CONFIG_KEY);
  if (sessionData) {
    try {
      return JSON.parse(sessionData);
    } catch {}
  }

  // Fallback to localStorage (new tab, sanitized config only)
  const localData = localStorage.getItem(CONFIG_KEY);
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch {}
  }

  return null;
}

export function clearConfigStorage() {
  sessionStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(CONFIG_KEY);
}
