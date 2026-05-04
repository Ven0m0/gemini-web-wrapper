import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService, AIImageError } from './ai';
import { API_BASE } from '../constants/api';
import * as jsonHealer from '../utils/jsonHealer';

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    aiService = new AIService('test-api-key', 'test-model', 0.5, 'test-provider', 'test-provider-key', 'http://test-base-url');
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
      json: async () => { throw new Error('Not JSON'); },
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

  describe('estimateTokens', () => {
    it('estimates tokens based on length / 4', async () => {
      expect(await aiService.estimateTokens('1234')).toBe(1);
      expect(await aiService.estimateTokens('12345')).toBe(2);
      expect(await aiService.estimateTokens('')).toBe(0);
    });
  });

  describe('transformFile', () => {
    it('successfully transforms file and removes AI artifacts', async () => {
      mockFetchSuccess({
        choices: [
          { message: { content: '---START FILE---\nconst x = 1;\n---END FILE---' } }
        ]
      });

      const result = await aiService.transformFile('add const', 'const y = 1;');
      expect(result).toBe('const x = 1;');

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/chat/completions`, expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key'
        }),
        body: expect.stringContaining('"x_provider":"test-provider"')
      }));
    });

    it('handles special gpt-5 model parameters', async () => {
      const gpt5Service = new AIService('key', 'gpt-5');
      mockFetchSuccess({
        choices: [{ message: { content: 'result' } }]
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

      await expect(aiService.transformFile('inst', 'content')).rejects.toThrow('Failed to transform file: Error: API error: 500 Internal Server Error');
    });

    it('throws error when no choices returned', async () => {
      mockFetchSuccess({ choices: [] });

      await expect(aiService.transformFile('inst', 'content')).rejects.toThrow('No response from AI');
    });
  });

  describe('chatCompletion', () => {
    it('successfully returns completion', async () => {
      mockFetchSuccess({
        choices: [
          { message: { content: 'Hello there' } }
        ]
      });

      const result = await aiService.chatCompletion([{ role: 'user', content: 'Hi' }]);
      expect(result).toBe('Hello there');
    });

    it('throws error when API response is not ok', async () => {
      mockFetchError(400, 'Bad Request', 'Error');

      await expect(aiService.chatCompletion([{ role: 'user', content: 'Hi' }])).rejects.toThrow('Failed to get chat completion: Error: API error: 400 Bad Request');
    });
  });

  describe('JSON methods', () => {
    it('transformFileJSON uses healJSON', async () => {
      const healSpy = vi.spyOn(jsonHealer, 'healJSON').mockReturnValue({ success: true, data: { healed: true } } as any);
      mockFetchSuccess({
        choices: [{ message: { content: '{"raw":true}' } }]
      });

      const result = await aiService.transformFileJSON('inst', 'content', { type: 'object' });
      expect(result).toEqual({ success: true, data: { healed: true } });
      expect(healSpy).toHaveBeenCalledWith('{"raw":true}', { type: 'object' });
    });

    it('chatCompletionJSON passes response_format and uses healJSON', async () => {
      const healSpy = vi.spyOn(jsonHealer, 'healJSON').mockReturnValue({ success: true, data: { healed: true } } as any);
      mockFetchSuccess({
        choices: [{ message: { content: '{"raw":true}' } }]
      });

      const result = await aiService.chatCompletionJSON([{ role: 'user', content: 'Hi' }], { type: 'object' });

      expect(result).toEqual({ success: true, data: { healed: true } });

      const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchArgs[1]?.body as string);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(healSpy).toHaveBeenCalledWith('{"raw":true}', { type: 'object' });
    });
  });

  describe('generateImage', () => {
    it('throws error if prompt is empty', async () => {
      await expect(aiService.generateImage('   ')).rejects.toThrow('Image prompt is empty');
    });

    it('returns base64 directly if b64_json is provided', async () => {
      mockFetchSuccess({
        data: [{ b64_json: 'base64data' }]
      });

      const result = await aiService.generateImage('cat');
      expect(result).toBe('base64data');
    });

    it('fetches and converts image URL to base64 if url is provided', async () => {
      // First fetch: OpenAI API
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: [{ url: 'http://image.url' }] })
      });

      // Second fetch: Image URL
      const mockArrayBuffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer
      });

      const result = await aiService.generateImage('cat');
      // btoa('Hello') -> SGVsbG8=
      expect(result).toBe('SGVsbG8=');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws AIImageError on failure with JSON error body', async () => {
      const errorBody = JSON.stringify({ error: { message: 'Image policy violation' } });
      mockFetchError(400, 'Bad Request', errorBody);

      try {
        await aiService.generateImage('cat');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AIImageError);
        expect(err.status).toBe(400);
        expect(err.statusText).toBe('Bad Request');
        expect(err.body).toBe(errorBody);
        expect(err.message).toContain('Image policy violation');
      }
    });

    it('throws AIImageError on failure with text error body', async () => {
      const errorBody = 'Plain text error';
      mockFetchError(500, 'Internal Server Error', errorBody);

      try {
        await aiService.generateImage('cat');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AIImageError);
        expect(err.message).toContain('Plain text error');
      }
    });

    it('throws error if fetching image URL fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: [{ url: 'http://image.url' }] })
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(aiService.generateImage('cat')).rejects.toThrow('Failed to fetch generated image URL: 404 Not Found');
    });

    it('throws error if unsupported format returned', async () => {
      mockFetchSuccess({
        data: [{ something_else: 'value' }]
      });

      await expect(aiService.generateImage('cat')).rejects.toThrow('Unsupported image response format from AI');
    });

    it('throws error if no item returned', async () => {
      mockFetchSuccess({
        data: []
      });

      await expect(aiService.generateImage('cat')).rejects.toThrow('No image returned from AI');
    });
  });
});
