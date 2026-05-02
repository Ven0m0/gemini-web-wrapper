import { describe, expect, it } from 'vitest';
import {
  createDefaultProviders,
  ensureProviderSelection,
  ensureModelSelection,
  isBuiltinProvider,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL_ID,
  type ProviderConfig
} from './providers';

describe('providers service', () => {
  describe('createDefaultProviders', () => {
    it('returns a list of default providers with uids', () => {
      const providers = createDefaultProviders();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0].id).toBe('gemini');
      expect(providers[0].builtin).toBe(true);
      // Models should have generated uids
      expect(providers[0].models[0].uid).toBeDefined();
    });

    it('clones models to ensure unique instances', () => {
      const providers1 = createDefaultProviders();
      const providers2 = createDefaultProviders();
      expect(providers1[0].models[0]).not.toBe(providers2[0].models[0]);
    });
  });

  describe('ensureProviderSelection', () => {
    const mockProviders: ProviderConfig[] = [
      { id: 'custom-1', name: 'Custom 1', apiKey: '', baseUrl: '', models: [] },
      { id: 'custom-2', name: 'Custom 2', apiKey: '', baseUrl: '', models: [] },
    ];

    it('returns the requested provider ID if it exists in providers', () => {
      expect(ensureProviderSelection('custom-2', mockProviders)).toBe('custom-2');
    });

    it('falls back to the first available provider if requested provider is missing', () => {
      expect(ensureProviderSelection('unknown', mockProviders)).toBe('custom-1');
    });

    it('falls back to DEFAULT_PROVIDER_ID if providers array is empty', () => {
      expect(ensureProviderSelection('unknown', [])).toBe(DEFAULT_PROVIDER_ID);
    });
  });

  describe('ensureModelSelection', () => {
    const mockProviders: ProviderConfig[] = [
      {
        id: 'custom-1',
        name: 'Custom 1',
        apiKey: '',
        baseUrl: '',
        models: [
          { id: 'model-1a', name: 'Model 1A' },
          { id: 'model-1b', name: 'Model 1B' },
        ],
      },
      {
        id: 'custom-2',
        name: 'Custom 2',
        apiKey: '',
        baseUrl: '',
        models: [], // No models
      },
    ];

    it('returns the requested model ID if it exists for the resolved provider', () => {
      expect(ensureModelSelection('custom-1', 'model-1b', mockProviders)).toBe('model-1b');
    });

    it('falls back to the first available model of the provider if requested model is missing', () => {
      expect(ensureModelSelection('custom-1', 'unknown-model', mockProviders)).toBe('model-1a');
    });

    it('resolves the provider first and then checks its models', () => {
      // 'unknown-provider' falls back to 'custom-1', then checks for 'model-1b' in 'custom-1'
      expect(ensureModelSelection('unknown-provider', 'model-1b', mockProviders)).toBe('model-1b');
    });

    it('falls back to DEFAULT_MODEL_ID if the resolved provider has no models', () => {
      expect(ensureModelSelection('custom-2', 'model-2a', mockProviders)).toBe(DEFAULT_MODEL_ID);
    });

    it('falls back to DEFAULT_MODEL_ID if providers array is empty', () => {
      expect(ensureModelSelection('custom-1', 'model-1a', [])).toBe(DEFAULT_MODEL_ID);
    });
  });

  describe('isBuiltinProvider', () => {
    it('returns true for known built-in providers', () => {
      expect(isBuiltinProvider('gemini')).toBe(true);
      expect(isBuiltinProvider('anthropic')).toBe(true);
      expect(isBuiltinProvider('copilot')).toBe(true);
    });

    it('returns false for unknown providers', () => {
      expect(isBuiltinProvider('unknown-provider')).toBe(false);
      expect(isBuiltinProvider('custom-1')).toBe(false);
    });
  });
});
