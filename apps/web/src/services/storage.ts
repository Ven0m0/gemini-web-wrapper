import type { ConfigState } from '../store';
import type { ProviderConfig } from './providers';

const CONFIG_KEY = 'chat-github-config';
const SECRETS_KEY = 'chat-github-secrets';

export function sanitizeConfig(config: Partial<ConfigState>): Partial<ConfigState> {
  const { githubToken: _githubToken, openaiKey: _openaiKey, providers, ...safeConfig } = config;

  const safeProviders = providers?.map((provider: ProviderConfig) => {
    const { apiKey: _apiKey, ...safeProvider } = provider;
    return safeProvider as ProviderConfig;
  });

  return {
    ...safeConfig,
    ...(safeProviders ? { providers: safeProviders } : {})
  };
}

export function extractSecrets(config: Partial<ConfigState>): Record<string, unknown> {
  const secrets: Record<string, unknown> = {};
  if (config.githubToken !== undefined) secrets.githubToken = config.githubToken;
  if (config.openaiKey !== undefined) secrets.openaiKey = config.openaiKey;

  if (config.providers) {
    const providerApiKeys: Record<string, string> = {};
    secrets.providerApiKeys = providerApiKeys;
    config.providers.forEach((provider) => {
      if (provider.apiKey !== undefined) {
        providerApiKeys[provider.id] = provider.apiKey;
      }
    });
  }

  return secrets;
}

export function saveConfigToStorage(config: Partial<ConfigState>, rememberSettings: boolean) {
  const safeConfig = sanitizeConfig(config);
  const secrets = extractSecrets(config);

  if (rememberSettings) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
  } else {
    localStorage.removeItem(CONFIG_KEY);
  }

  // Always save secrets to session storage for the current tab
  sessionStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
}

export function loadConfigFromStorage(): Partial<ConfigState> | null {
  // Migrate/cleanup existing data in localStorage
  const rawSaved = localStorage.getItem(CONFIG_KEY);
  if (rawSaved) {
    try {
      const parsed = JSON.parse(rawSaved);
      // Check if it contains secrets that need to be purged
      if (parsed.githubToken !== undefined || parsed.openaiKey !== undefined || (parsed.providers && parsed.providers.some((p: ProviderConfig) => p.apiKey !== undefined))) {
        saveConfigToStorage(parsed, true);
      }
    } catch {}
  }

  const savedSafe = localStorage.getItem(CONFIG_KEY);
  const savedSecretsStr = sessionStorage.getItem(SECRETS_KEY);

  if (!savedSafe && !savedSecretsStr) {
    return null;
  }

  let safeConfig: Partial<ConfigState> = {};
  let secrets: Record<string, unknown> = {};

  if (savedSafe) {
    try {
      safeConfig = JSON.parse(savedSafe);
    } catch {}
  }

  if (savedSecretsStr) {
    try {
      secrets = JSON.parse(savedSecretsStr);
    } catch {}
  }

  const mergedConfig = { ...safeConfig };

  if (typeof secrets.githubToken === 'string') {
    mergedConfig.githubToken = secrets.githubToken;
  }
  if (typeof secrets.openaiKey === 'string') {
    mergedConfig.openaiKey = secrets.openaiKey;
  }

  if (mergedConfig.providers && typeof secrets.providerApiKeys === 'object' && secrets.providerApiKeys !== null) {
    mergedConfig.providers = mergedConfig.providers.map((provider: ProviderConfig) => {
      const providerApiKeys = secrets.providerApiKeys as Record<string, string | undefined>;
      const apiKey = providerApiKeys[provider.id];
      if (apiKey !== undefined) {
        return { ...provider, apiKey };
      }
      return provider;
    });
  }

  return mergedConfig;
}

export function clearConfigFromStorage() {
  localStorage.removeItem(CONFIG_KEY);
  sessionStorage.removeItem(SECRETS_KEY);
}

export function hasSavedSettings() {
  return Boolean(localStorage.getItem(CONFIG_KEY));
}
