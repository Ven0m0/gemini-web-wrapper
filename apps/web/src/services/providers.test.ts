import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeProvidersConfig, createDefaultProviders } from './providers';

// Mock generateId to ensure deterministic tests
let idCounter = 0;
vi.mock('../utils/id', () => ({
  generateId: () => {
    idCounter += 1;
    return `mock-id-${idCounter}`;
  }
}));

describe('normalizeProvidersConfig', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('should return default providers when config is empty or null', () => {
    // Generate defaults with the mocked ID
    const defaults = createDefaultProviders();
    idCounter = 0; // reset for the test call
    expect(normalizeProvidersConfig()).toEqual(defaults);

    idCounter = 0;
    expect(normalizeProvidersConfig(null)).toEqual(defaults);

    idCounter = 0;
    expect(normalizeProvidersConfig({})).toEqual(defaults);
  });

  it('should migrate legacy keys (geminiKey and anthropicKey) into builtin providers', () => {
    const result = normalizeProvidersConfig({
      geminiKey: 'legacy-gemini-key',
      anthropicKey: 'legacy-anthropic-key'
    });

    const gemini = result.find(p => p.id === 'gemini');
    const anthropic = result.find(p => p.id === 'anthropic');

    expect(gemini?.apiKey).toBe('legacy-gemini-key');
    expect(anthropic?.apiKey).toBe('legacy-anthropic-key');
  });

  it('should override builtin providers but retain their builtin status when overridden with custom props', () => {
    const customConfig = {
      providers: [
        {
          id: 'gemini',
          name: 'Custom Gemini',
          apiKey: 'custom-api-key',
          baseUrl: 'https://custom.gemini.url',
          models: [{ id: 'gemini-custom', name: 'Gemini Custom Model' }]
        }
      ]
    };

    const result = normalizeProvidersConfig(customConfig);
    const overriddenGemini = result.find(p => p.id === 'gemini');

    expect(overriddenGemini).toBeDefined();
    expect(overriddenGemini?.name).toBe('Custom Gemini');
    expect(overriddenGemini?.apiKey).toBe('custom-api-key');
    expect(overriddenGemini?.baseUrl).toBe('https://custom.gemini.url');
    expect(overriddenGemini?.models.length).toBe(1);
    expect(overriddenGemini?.models[0].id).toBe('gemini-custom');
    expect(overriddenGemini?.builtin).toBe(true); // Should remain true because it's merged into a builtin
  });

  it('should append valid custom providers to the end of the list', () => {
    const defaults = createDefaultProviders();
    idCounter = 0; // Reset after default generation
    const customConfig = {
      providers: [
        {
          id: 'custom-1',
          name: 'Custom Provider 1',
          models: [{ id: 'm1', name: 'M1' }]
        }
      ]
    };

    const result = normalizeProvidersConfig(customConfig);

    expect(result.length).toBe(defaults.length + 1);
    const lastProvider = result[result.length - 1];
    expect(lastProvider.id).toBe('custom-1');
    expect(lastProvider.name).toBe('Custom Provider 1');
    expect(lastProvider.builtin).toBe(false);
  });

  it('should filter out invalid providers (no ID or not an object)', () => {
    const customConfig = {
      providers: [
        null,
        undefined,
        "string-provider",
        { name: 'No ID Provider' },
        { id: '', name: 'Empty ID' },
        { id: 'valid', name: 'Valid' }
      ]
    };

    const result = normalizeProvidersConfig(customConfig);
    const defaults = createDefaultProviders();

    expect(result.length).toBe(defaults.length + 1);
    expect(result[result.length - 1].id).toBe('valid');
  });

  it('should handle providers with empty models arrays by providing a fallback model', () => {
    const customConfig = {
      providers: [
        {
          id: 'custom-no-model',
          models: []
        }
      ]
    };

    const result = normalizeProvidersConfig(customConfig);
    const customProvider = result.find(p => p.id === 'custom-no-model');

    expect(customProvider?.models.length).toBe(1);
    // index is 0, so fallback is 1
    expect(customProvider?.models[0].id).toBe('__fallback_custom-no-model_1');
    expect(customProvider?.models[0].name).toBe('Default Model');
    expect(customProvider?.models[0].uid).toBe('mock-id-16'); // 15 models in default list generated
  });

  it('should normalize models correctly filtering out duplicates or missing IDs', () => {
    const customConfig = {
      providers: [
        {
          id: 'custom-provider',
          models: [
            { id: 'm1', name: 'M1' },
            { id: 'm1', name: 'M1 Dup' }, // Duplicate ID, should be filtered
            "invalid-string-model", // Should be converted to fallback ID index 3
            { name: 'No ID Model' }, // Should use fallback ID index 4
            null // Should use fallback ID index 5
          ]
        }
      ]
    };

    const result = normalizeProvidersConfig(customConfig);
    const customProvider = result.find(p => p.id === 'custom-provider');

    expect(customProvider?.models.length).toBe(4);

    // First model
    expect(customProvider?.models[0].id).toBe('m1');

    // String model (invalid) fallback - index in original array is 2 so index+1 is 3
    expect(customProvider?.models[1].id).toBe('__fallback_custom-provider_3');

    // No ID model fallback - index in original array is 3 so index+1 is 4
    expect(customProvider?.models[2].id).toBe('__fallback_custom-provider_4');

    // null model fallback - index in original array is 4 so index+1 is 5
    expect(customProvider?.models[3].id).toBe('__fallback_custom-provider_5');
  });

  it('should filter out custom providers completely if they claim to be builtin', () => {
    const customConfig = {
      providers: [
        {
          id: 'sneaky-custom',
          builtin: true,
          models: [{id: 'm1', name: 'm1'}]
        }
      ]
    };

    const result = normalizeProvidersConfig(customConfig);
    const customProvider = result.find(p => p.id === 'sneaky-custom');

    // The source code specifically filters out custom providers that claim to be builtin
    // .filter((provider) => !mergedBuiltinIds.has(provider.id) && !provider.builtin)
    expect(customProvider).toBeUndefined();
  });
});
