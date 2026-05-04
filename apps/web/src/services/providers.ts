import { generateId } from '../utils/id';
import { normalizeString } from '../utils/string';

export interface ProviderModelOption {
  id: string;
  name: string;
  uid?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: ProviderModelOption[];
  builtin?: boolean;
}

type LegacyConfigLike = {
  provider?: unknown;
  model?: unknown;
  geminiKey?: unknown;
  anthropicKey?: unknown;
  providers?: unknown;
};

const BUILTIN_PROVIDER_DEFINITIONS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    apiKey: '',
    baseUrl: '',
    builtin: true,
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Recommended)' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: '',
    baseUrl: '',
    builtin: true,
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Recommended)' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    apiKey: '',
    baseUrl: 'https://api.githubcopilot.com',
    builtin: true,
    models: [
      { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6 (Recommended)' },
      { id: 'claude-opus-4.6', name: 'Claude Opus 4.6' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
    ],
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    apiKey: '',
    baseUrl: 'http://localhost:4096/zen/v1',
    builtin: true,
    models: [
      { id: 'opencode/glm-5.1', name: 'GLM 5.1 (Recommended)' },
      { id: 'opencode/kimi-k2.5', name: 'Kimi K2.5' },
      { id: 'opencode/big-pickle', name: 'Big Pickle' },
    ],
  },
  {
    id: 'kilo-gateway',
    name: 'Kilo Gateway',
    apiKey: '',
    baseUrl: 'https://api.kilo.ai/api/gateway',
    builtin: true,
    models: [
      { id: 'kilo-auto/frontier', name: 'Kilo Auto Frontier' },
      { id: 'kilo-auto/balanced', name: 'Kilo Auto Balanced' },
      { id: 'kilo-auto/free', name: 'Kilo Auto Free' },
    ],
  },
];

export const DEFAULT_PROVIDER_ID = 'gemini';
export const DEFAULT_MODEL_ID = BUILTIN_PROVIDER_DEFINITIONS[0]?.models[0]?.id ?? 'gemini-3.1-pro-preview';

function cloneProvider(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    models: provider.models.map((model) => ({
      ...model,
      uid: model.uid ?? generateId(),
    })),
  };
}

function normalizeModel(model: unknown, fallbackId: string, fallbackName: string): ProviderModelOption {
  if (!model || typeof model !== 'object') {
    return { id: fallbackId, name: fallbackName, uid: generateId() };
  }

  const id = normalizeString((model as { id?: unknown }).id) || fallbackId;
  const name = normalizeString((model as { name?: unknown }).name) || id || fallbackName;
  const uid = normalizeString((model as { uid?: unknown }).uid) || generateId();
  return { id, name, uid };
}

function createFallbackModelId(providerId: string, index: number): string {
  return `__fallback_${providerId}_${index + 1}`;
}

function normalizeProvider(provider: unknown): ProviderConfig | null {
  if (!provider || typeof provider !== 'object') {
    return null;
  }

  const candidate = provider as {
    id?: unknown;
    name?: unknown;
    apiKey?: unknown;
    baseUrl?: unknown;
    models?: unknown;
    builtin?: unknown;
  };

  const id = normalizeString(candidate.id);
  if (!id) {
    return null;
  }

  const models = Array.isArray(candidate.models)
    ? (() => {
        const seenIds = new Set<string>();
        return candidate.models
          .map((model, index) => normalizeModel(model, createFallbackModelId(id, index), `Model ${index + 1}`))
          .filter((model) => {
            if (!model.id || seenIds.has(model.id)) {
              return false;
            }
            seenIds.add(model.id);
            return true;
          });
      })()
    : [];

  return {
    id,
    name: normalizeString(candidate.name) || id,
    apiKey: normalizeString(candidate.apiKey),
    baseUrl: normalizeString(candidate.baseUrl),
    builtin: candidate.builtin === true,
    models,
  };
}

export function createDefaultProviders(): ProviderConfig[] {
  return BUILTIN_PROVIDER_DEFINITIONS.map(cloneProvider);
}

export function getProviderById(providers: ProviderConfig[], providerId: string): ProviderConfig | undefined {
  return providers.find((provider) => provider.id === providerId);
}

export function getFlattenedProviderModels(providers: ProviderConfig[]) {
  return providers.flatMap((provider) =>
    provider.models.map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      modelName: model.name,
      key: `${provider.id}::${model.id}`,
      label: `${provider.name} · ${model.name}`,
    }))
  );
}

let cachedNullConfig: ProviderConfig[] | undefined;
let cachedUndefinedConfig: ProviderConfig[] | undefined;
const configCache = new WeakMap<object, ProviderConfig[]>();

export function normalizeProvidersConfig(configLike?: LegacyConfigLike | null): ProviderConfig[] {
  if (configLike === null) {
    if (cachedNullConfig) return cachedNullConfig;
  } else if (configLike === undefined) {
    if (cachedUndefinedConfig) return cachedUndefinedConfig;
  } else if (typeof configLike === 'object') {
    const cached = configCache.get(configLike);
    if (cached) return cached;
  }

  const defaults = createDefaultProviders();
  const normalizedProviders = Array.isArray(configLike?.providers)
    ? configLike.providers.map(normalizeProvider).filter((provider): provider is ProviderConfig => provider !== null)
    : [];

  const normalizedProviderMap = new Map<string, ProviderConfig>();
  for (const provider of normalizedProviders) {
    const existing = normalizedProviderMap.get(provider.id);
    if (!existing || (existing.builtin && !provider.builtin)) {
      normalizedProviderMap.set(provider.id, provider);
    }
  }

  const mergedBuiltinIds = new Set<string>();
  const mergedProviders = defaults.map((builtin) => {
    const override = normalizedProviderMap.get(builtin.id);
    if (override) {
      mergedBuiltinIds.add(override.id);
      return {
        ...builtin,
        name: override.name || builtin.name,
        apiKey: override.apiKey || builtin.apiKey,
        baseUrl: override.baseUrl || builtin.baseUrl,
        models: override.models.length > 0 ? override.models : builtin.models,
      };
    }

    if (builtin.id === 'gemini') {
      return {
        ...builtin,
        apiKey: normalizeString(configLike?.geminiKey) || builtin.apiKey,
      };
    }

    if (builtin.id === 'anthropic') {
      return {
        ...builtin,
        apiKey: normalizeString(configLike?.anthropicKey) || builtin.apiKey,
      };
    }

    return builtin;
  });

  const customProviders = Array.from(normalizedProviderMap.values())
    .filter((provider) => !mergedBuiltinIds.has(provider.id) && !provider.builtin)
    .map((provider) => ({
      ...provider,
      models:
        provider.models.length > 0
          ? provider.models
          : [{ id: createFallbackModelId(provider.id, 0), name: 'Default Model', uid: generateId() }],
    }));

  const result = [...mergedProviders, ...customProviders];

  if (configLike === null) {
    cachedNullConfig = result;
  } else if (configLike === undefined) {
    cachedUndefinedConfig = result;
  } else if (typeof configLike === 'object') {
    configCache.set(configLike, result);
  }

  return result;
}

export function ensureProviderSelection(providerId: string, providers: ProviderConfig[]): string {
  if (getProviderById(providers, providerId)) {
    return providerId;
  }
  return providers[0]?.id ?? DEFAULT_PROVIDER_ID;
}

export function ensureModelSelection(providerId: string, modelId: string, providers: ProviderConfig[]): string {
  const resolvedProvider = getProviderById(providers, ensureProviderSelection(providerId, providers));
  if (!resolvedProvider) {
    return DEFAULT_MODEL_ID;
  }

  if (resolvedProvider.models.some((model) => model.id === modelId)) {
    return modelId;
  }

  return resolvedProvider.models[0]?.id ?? DEFAULT_MODEL_ID;
}

export function migrateProviderSelections<
  T extends { provider?: string; model?: string; providers?: ProviderConfig[] },
>(config: T): T {
  const providers = normalizeProvidersConfig(config);
  const provider = ensureProviderSelection(config.provider ?? DEFAULT_PROVIDER_ID, providers);
  const model = ensureModelSelection(provider, config.model ?? DEFAULT_MODEL_ID, providers);

  return {
    ...config,
    providers,
    provider,
    model,
  };
}

export function migrateSavedConfig<T extends { provider?: string; model?: string; providers?: ProviderConfig[] }>(
  config: T
): T {
  const migrated = migrateProviderSelections(config);
  if (
    !Array.isArray((config as LegacyConfigLike).providers) &&
    typeof migrated.model === 'string' &&
    migrated.model.startsWith('gpt-')
  ) {
    return {
      ...migrated,
      provider: DEFAULT_PROVIDER_ID,
      model: DEFAULT_MODEL_ID,
    };
  }
  return migrated;
}
