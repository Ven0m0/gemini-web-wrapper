import { type ConfigState } from '../store';
import { type ProviderConfig } from './providers';

const STORAGE_KEY = 'chat-github-config';
const SESSION_KEY = 'chat-github-credentials';

export function sanitizeConfig(config: Partial<ConfigState>): Partial<ConfigState> {
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

export function saveConfig(config: Partial<ConfigState>) {
  const sanitized = sanitizeConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));

  const credentials = {
    githubToken: config.githubToken,
    openaiKey: config.openaiKey,
    providers: config.providers?.map((p) => ({ id: p.id, apiKey: p.apiKey })) || [],
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(credentials));
}

export function loadConfig(): Partial<ConfigState> | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  try {
    const config = JSON.parse(saved);
    const sessionSaved = sessionStorage.getItem(SESSION_KEY);

    if (sessionSaved) {
      try {
        const credentials = JSON.parse(sessionSaved);
        if (credentials.githubToken) config.githubToken = credentials.githubToken;
        if (credentials.openaiKey) config.openaiKey = credentials.openaiKey;

        if (config.providers && credentials.providers) {
          config.providers = config.providers.map((p: ProviderConfig) => {
            const cred = credentials.providers.find((c: { id: string; apiKey: string }) => c.id === p.id);
            if (cred) {
              return { ...p, apiKey: cred.apiKey };
            }
            return p;
          });
        }
      } catch {
        // ignore session parsing error
      }
    }

    return config;
  } catch {
    return null;
  }
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSavedConfig(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}
