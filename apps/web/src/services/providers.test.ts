import { describe, expect, it, vi } from 'vitest';
import { normalizeProvidersConfig, createDefaultProviders } from './providers';

// We mock generateId so we don't have to deal with random uids in models
vi.mock('../utils/id', () => ({
  generateId: () => 'mocked-id',
}));

describe('normalizeProvidersConfig', () => {
  it('should return default providers when config is null or undefined', () => {
    const defaults = createDefaultProviders();
    expect(normalizeProvidersConfig(undefined)).toEqual(defaults);
    expect(normalizeProvidersConfig(null)).toEqual(defaults);
  });

  it('should handle legacy geminiKey and anthropicKey', () => {
    const config = {
      geminiKey: 'legacy-gemini-key',
      anthropicKey: 'legacy-anthropic-key',
    };

    const result = normalizeProvidersConfig(config);

    const gemini = result.find(p => p.id === 'gemini');
    expect(gemini?.apiKey).toBe('legacy-gemini-key');

    const anthropic = result.find(p => p.id === 'anthropic');
    expect(anthropic?.apiKey).toBe('legacy-anthropic-key');
  });

  it('should apply overrides to built-in providers from providers array', () => {
    const config = {
      providers: [
        {
          id: 'gemini',
          apiKey: 'new-gemini-key',
          baseUrl: 'https://custom-gemini.com',
          name: 'Custom Gemini Name'
        }
      ]
    };

    const result = normalizeProvidersConfig(config);
    const gemini = result.find(p => p.id === 'gemini');

    expect(gemini?.apiKey).toBe('new-gemini-key');
    expect(gemini?.baseUrl).toBe('https://custom-gemini.com');
    expect(gemini?.name).toBe('Custom Gemini Name');
  });

  it('should add custom providers', () => {
    const config = {
      providers: [
        {
          id: 'custom-provider',
          name: 'My Custom Provider',
          apiKey: 'custom-key',
          baseUrl: 'https://api.custom.com',
          models: [
            { id: 'custom-model-1', name: 'Custom Model 1' }
          ]
        }
      ]
    };

    const result = normalizeProvidersConfig(config);
    const custom = result.find(p => p.id === 'custom-provider');

    expect(custom).toBeDefined();
    expect(custom?.name).toBe('My Custom Provider');
    expect(custom?.apiKey).toBe('custom-key');
    expect(custom?.baseUrl).toBe('https://api.custom.com');
    expect(custom?.models).toHaveLength(1);
    expect(custom?.models[0].id).toBe('custom-model-1');
  });

  it('should create fallback model for custom providers if models array is empty or missing', () => {
    const config = {
      providers: [
        {
          id: 'no-models-provider',
          apiKey: 'key',
        }
      ]
    };

    const result = normalizeProvidersConfig(config);
    const custom = result.find(p => p.id === 'no-models-provider');

    expect(custom?.models).toHaveLength(1);
    expect(custom?.models[0].id).toBe('__fallback_no-models-provider_1');
    expect(custom?.models[0].name).toBe('Default Model');
    expect(custom?.models[0].uid).toBe('mocked-id');
  });

  it('should filter out invalid providers (no id)', () => {
    const config = {
      providers: [
        { name: 'Invalid Provider' },
        null,
        undefined,
        'string-provider'
      ]
    };

    const result = normalizeProvidersConfig(config);
    const defaults = createDefaultProviders();

    // Only the default providers should be returned
    expect(result).toEqual(defaults);
  });

  it('should deduplicate models within a custom provider by id', () => {
    const config = {
      providers: [
        {
          id: 'dup-models-provider',
          models: [
            { id: 'model-a', name: 'Model A' },
            { id: 'model-a', name: 'Model A Duplicate' },
            { id: 'model-b', name: 'Model B' }
          ]
        }
      ]
    };

    const result = normalizeProvidersConfig(config);
    const provider = result.find(p => p.id === 'dup-models-provider');

    expect(provider?.models).toHaveLength(2);
    expect(provider?.models[0].id).toBe('model-a');
    expect(provider?.models[0].name).toBe('Model A'); // Keeps the first one
    expect(provider?.models[1].id).toBe('model-b');
  });

  it('should gracefully normalize invalid models within a custom provider', () => {
    const config = {
      providers: [
        {
          id: 'invalid-models-provider',
          models: [
            null,
            'string-model',
            { name: 'No ID Model' } // Should fallback to __fallback_id_index
          ]
        }
      ]
    };

    const result = normalizeProvidersConfig(config);
    const provider = result.find(p => p.id === 'invalid-models-provider');

    expect(provider?.models).toHaveLength(3);
    expect(provider?.models[0].id).toBe('__fallback_invalid-models-provider_1');
    expect(provider?.models[1].id).toBe('__fallback_invalid-models-provider_2');
    expect(provider?.models[2].id).toBe('__fallback_invalid-models-provider_3');
  });
});
