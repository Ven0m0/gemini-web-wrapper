import { describe, expect, it } from 'vitest';
import {
  ensureModelSelection,
  ensureProviderSelection,
  getProviderById,
  normalizeProvidersConfig,
  migrateSavedConfig,
  ProviderConfig,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL_ID,
} from './providers';

describe('providers service', () => {
  const mockProviders: ProviderConfig[] = [
    {
      id: 'provider-1',
      name: 'Provider 1',
      apiKey: 'key-1',
      baseUrl: 'url-1',
      models: [
        { id: 'model-1a', name: 'Model 1A' },
        { id: 'model-1b', name: 'Model 1B' },
      ],
    },
    {
      id: 'provider-2',
      name: 'Provider 2',
      apiKey: 'key-2',
      baseUrl: 'url-2',
      models: [{ id: 'model-2a', name: 'Model 2A' }],
    },
  ];

  describe('getProviderById', () => {
    it('returns the correct provider by ID', () => {
      expect(getProviderById(mockProviders, 'provider-2')).toEqual(mockProviders[1]);
    });

    it('returns undefined for non-existent provider ID', () => {
      expect(getProviderById(mockProviders, 'unknown-provider')).toBeUndefined();
    });
  });

  describe('ensureProviderSelection', () => {
    it('returns the provided ID if the provider exists', () => {
      expect(ensureProviderSelection('provider-2', mockProviders)).toBe('provider-2');
    });

    it('returns the first provider ID if the requested one does not exist', () => {
      expect(ensureProviderSelection('unknown-provider', mockProviders)).toBe('provider-1');
    });

    it('returns DEFAULT_PROVIDER_ID if the providers array is empty', () => {
      expect(ensureProviderSelection('unknown-provider', [])).toBe(DEFAULT_PROVIDER_ID);
    });
  });

  describe('ensureModelSelection', () => {
    it('returns the requested model ID if it exists in the requested provider', () => {
      expect(ensureModelSelection('provider-1', 'model-1b', mockProviders)).toBe('model-1b');
    });

    it('returns the first model ID of the provider if the requested model does not exist', () => {
      expect(ensureModelSelection('provider-1', 'unknown-model', mockProviders)).toBe('model-1a');
    });

    it('falls back to the first provider and its first model if requested provider does not exist', () => {
      expect(ensureModelSelection('unknown-provider', 'unknown-model', mockProviders)).toBe('model-1a');
    });

    it('returns DEFAULT_MODEL_ID if providers array is empty', () => {
      expect(ensureModelSelection('provider-1', 'model-1a', [])).toBe(DEFAULT_MODEL_ID);
    });

    it('returns DEFAULT_MODEL_ID if resolved provider has no models', () => {
      const providersWithNoModels: ProviderConfig[] = [{ ...mockProviders[0], models: [] }];
      expect(ensureModelSelection('provider-1', 'model-1a', providersWithNoModels)).toBe(DEFAULT_MODEL_ID);
    });
  });

  describe('normalizeProvidersConfig', () => {
    it('returns default providers when config is undefined', () => {
      const providers = normalizeProvidersConfig(undefined);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.some((p) => p.id === 'gemini')).toBe(true);
    });

    it('returns default providers when config is null', () => {
      const providers = normalizeProvidersConfig(null);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.some((p) => p.id === 'gemini')).toBe(true);
    });

    it('merges custom API keys for built-in providers', () => {
      const providers = normalizeProvidersConfig({
        geminiKey: 'custom-gemini-key',
        anthropicKey: 'custom-anthropic-key',
      });
      const gemini = providers.find((p) => p.id === 'gemini');
      const anthropic = providers.find((p) => p.id === 'anthropic');

      expect(gemini?.apiKey).toBe('custom-gemini-key');
      expect(anthropic?.apiKey).toBe('custom-anthropic-key');
    });

    it('includes custom providers from the config', () => {
      const providers = normalizeProvidersConfig({
        providers: [
          {
            id: 'custom-provider',
            name: 'Custom Provider',
            apiKey: 'custom-key',
            baseUrl: 'custom-url',
            models: [{ id: 'custom-model', name: 'Custom Model' }],
          },
        ],
      });

      const custom = providers.find((p) => p.id === 'custom-provider');
      expect(custom).toBeDefined();
      expect(custom?.name).toBe('Custom Provider');
      expect(custom?.models[0].id).toBe('custom-model');
    });

    it('creates a fallback model for custom providers without models', () => {
      const providers = normalizeProvidersConfig({
        providers: [
          {
            id: 'custom-provider-no-models',
            name: 'Custom Provider',
            apiKey: 'custom-key',
            baseUrl: 'custom-url',
            models: [],
          },
        ],
      });

      const custom = providers.find((p) => p.id === 'custom-provider-no-models');
      expect(custom).toBeDefined();
      expect(custom?.models.length).toBe(1);
      expect(custom?.models[0].id).toContain('__fallback_');
    });
  });

  describe('migrateSavedConfig', () => {
    it('migrates from legacy config formats', () => {
      const result = migrateSavedConfig({
        provider: 'unknown-provider',
        model: 'unknown-model',
      });

      expect(result.providers).toBeDefined();
      expect(result.provider).toBe(DEFAULT_PROVIDER_ID);
      expect(result.model).toBe(DEFAULT_MODEL_ID);
    });

    it('resets legacy GPT model selection to default', () => {
      const result = migrateSavedConfig({
        provider: 'openai',
        model: 'gpt-4o',
      });

      expect(result.provider).toBe(DEFAULT_PROVIDER_ID);
      expect(result.model).toBe(DEFAULT_MODEL_ID);
    });

    it('preserves valid provider and model selections', () => {
      const providers = normalizeProvidersConfig(undefined);
      const firstBuiltinId = providers[0].id;
      const firstBuiltinModelId = providers[0].models[0].id;

      const result = migrateSavedConfig({
        provider: firstBuiltinId,
        model: firstBuiltinModelId,
      });

      expect(result.provider).toBe(firstBuiltinId);
      expect(result.model).toBe(firstBuiltinModelId);
    });
  });
});
