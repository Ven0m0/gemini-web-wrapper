import { describe, expect, it, vi } from 'vitest';
import { repairJsonContent, isJsonPath } from './fileTools';
import * as jsonHealer from '../utils/jsonHealer';

describe('fileTools', () => {
  describe('repairJsonContent', () => {
    it('should return successfully with valid JSON content', () => {
      const validJson = '{"key": "value"}';
      const result = repairJsonContent(validJson);

      expect(result.content).toBe('{\n  "key": "value"\n}');
      expect(result.warnings).toEqual([]);
    });

    it('should heal and return missing bracket JSON', () => {
      const invalidJson = '{"key": "value"';
      const result = repairJsonContent(invalidJson);

      expect(result.content).toBe('{\n  "key": "value"\n}');
    });

    it('should throw an error if healJSON fails to return a valid object', () => {
      // Heal JSON returns a success: false if it fails
      // We will spy on healJSON to simulate a failure where success is false and there are errors
      const healJSONSpy = vi.spyOn(jsonHealer, 'healJSON').mockReturnValue({
        success: false,
        original: 'invalid',
        errors: ['Syntax error'],
      });

      expect(() => repairJsonContent('invalid')).toThrowError('Syntax error');

      healJSONSpy.mockRestore();
    });

    it('should handle heal warnings properly', () => {
      const healJSONSpy = vi.spyOn(jsonHealer, 'healJSON').mockReturnValue({
        success: true,
        data: { a: 1 },
        original: 'invalid',
        warnings: ['Some warning'],
      });

      const result = repairJsonContent('invalid');
      expect(result.content).toBe('{\n  "a": 1\n}');
      expect(result.warnings).toEqual(['Some warning']);

      healJSONSpy.mockRestore();
    });
  });

  describe('isJsonPath', () => {
    it('should return true for valid .json paths', () => {
      expect(isJsonPath('package.json')).toBe(true);
      expect(isJsonPath('/path/to/config.json')).toBe(true);
      expect(isJsonPath('  test.JSON  ')).toBe(true);
    });

    it('should return false for non .json paths', () => {
      expect(isJsonPath('file.js')).toBe(false);
      expect(isJsonPath('json.txt')).toBe(false);
      expect(isJsonPath('.json.js')).toBe(false);
      expect(isJsonPath('')).toBe(false);
    });
  });
});
