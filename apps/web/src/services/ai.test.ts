import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService } from './ai';
import { API_BASE } from '../constants/api';
import * as jsonHealer from '../utils/jsonHealer';

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    aiService = new AIService(
      'test-api-key',
      'test-model',
      0.5,
      'test-provider',
      'test-provider-key',
      'http://test-base-url'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockFetchSuccess = (responseData: any) => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => responseData,
      text: async () => JSON.stringify(responseData),
    });
  };

  const mockFetchError = (status: number, statusText: string, textResponse: string) => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status,
      statusText,
      json: async () => {
        throw new Error('Not JSON');
      },
      text: async () => textResponse,
    });
  };

  describe('constructor and properties', () => {
    it('initializes correctly with defaults', () => {
      const service = new AIService('key');
      expect((service as any).apiKey).toBe('key');
      expect((service as any).model).toBe('gemini-3.1-pro-preview');
      expect((service as any).temperature).toBe(0.3);
      expect((service as any).provider).toBeUndefined();
    });

    it('initializes correctly with provided values', () => {
      expect((aiService as any).apiKey).toBe('test-api-key');
      expect((aiService as any).model).toBe('test-model');
      expect((aiService as any).temperature).toBe(0.5);
      expect((aiService as any).provider).toBe('test-provider');
      expect((aiService as any).providerKey).toBe('test-provider-key');
      expect((aiService as any).providerBaseUrl).toBe('http://test-base-url');
    });
  });

  describe('transformFile', () => {
    it('successfully transforms file and removes AI artifacts', async () => {
      mockFetchSuccess({
        choices: [{ message: { content: '---START FILE---\nconst x = 1;\n---END FILE---' } }],
      });

      const result = await aiService.transformFile('add const', 'const y = 1;');
      expect(result).toBe('const x = 1;');

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE}/chat/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
          body: expect.stringContaining('"x_provider":"test-provider"'),
        })
      );
    });

    it('handles special gpt-5 model parameters', async () => {
      const gpt5Service = new AIService('key', 'gpt-5');
      mockFetchSuccess({
        choices: [{ message: { content: 'result' } }],
      });

      await gpt5Service.transformFile('inst', 'content');

      const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchArgs[1]?.body as string);

      expect(body.model).toBe('gpt-5');
      expect(body.max_completion_tokens).toBe(4000);
      expect(body.temperature).toBeUndefined(); // gpt-5 does not get temperature
    });

    it('throws error when API response is not ok', async () => {
      mockFetchError(500, 'Internal Server Error', 'Error');

      await expect(aiService.transformFile('inst', 'content')).rejects.toThrow(
        '500 Internal Server Error: Error'
      );
    });

    it('throws error when no choices returned', async () => {
      mockFetchSuccess({ choices: [] });

      await expect(aiService.transformFile('inst', 'content')).rejects.toThrow('No response from AI');
    });
  });

  describe('chatCompletion', () => {
    it('successfully returns completion', async () => {
      mockFetchSuccess({
        choices: [{ message: { content: 'Hello there' } }],
      });

      const result = await aiService.chatCompletion([{ role: 'user', content: 'Hi' }]);
      expect(result).toBe('Hello there');
    });

    it('throws error when API response is not ok', async () => {
      mockFetchError(400, 'Bad Request', 'Error');

      await expect(aiService.chatCompletion([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
        '400 Bad Request: Error'
      );
    });
  });

  describe('JSON methods', () => {
    it('chatCompletionJSON passes response_format and uses healJSON', async () => {
      const healSpy = vi
        .spyOn(jsonHealer, 'healJSON')
        .mockReturnValue({ success: true, data: { healed: true } } as any);
      mockFetchSuccess({
        choices: [{ message: { content: '{"raw":true}' } }],
      });

      const result = await aiService.chatCompletionJSON([{ role: 'user', content: 'Hi' }], { type: 'object' });

      expect(result).toEqual({ success: true, data: { healed: true } });

      const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchArgs[1]?.body as string);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(healSpy).toHaveBeenCalledWith('{"raw":true}', { type: 'object' });
    });
  });
});
