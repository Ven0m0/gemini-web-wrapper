import { describe, expect, it } from 'vitest';
import { collectLineImages, isSafeSrc } from './imagePreview';

describe('isSafeSrc', () => {
  it('should allow standard http/https URLs', () => {
    expect(isSafeSrc('http://example.com/image.png')).toBe(true);
    expect(isSafeSrc('https://example.com/image.png')).toBe(true);
  });

  it('should allow relative paths', () => {
    expect(isSafeSrc('/path/to/image.png')).toBe(true);
    expect(isSafeSrc('image.png')).toBe(true);
    expect(isSafeSrc('./image.png')).toBe(true);
    expect(isSafeSrc('../image.png')).toBe(true);
  });

  it('should allow safe data URLs', () => {
    expect(
      isSafeSrc(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      )
    ).toBe(true);
    expect(
      isSafeSrc(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMA4EAAII'
      )
    ).toBe(true);
    expect(isSafeSrc('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);
    expect(isSafeSrc('data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=')).toBe(true);
    expect(
      isSafeSrc(
        'data:image/avif,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAAltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAF2lsb2MAAAAAREAAAQABAAAAAAEOAAEAAAAAaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAMYXYwQzEwMAAAAABhdmFzAAAAAAAAABhhdjFj+EAsAgSgBQAAABNjb2xybmNseAABAAEAAYAAAAAYaXBycAAAAEphc3BjAAAAAAAAAAEAAGF1eGMAAAAAAAAAAQAAABNjb2xybmNseAABAAEAAYAAAAAbaXBtYQAAAAAAAAABAAEBAgGCAAAAAWJwaXhlbAAAAA1pc29wAAAAAAAAAAo='
      )
    ).toBe(true);
  });

  it('should block dangerous data URLs', () => {
    // This is the current vulnerability: SVG is allowed
    // We expect it to return FALSE eventually, but for reproduction it currently returns TRUE
    // I will write the test to expect FALSE so it FAILS now, confirming the vulnerability.
    expect(
      isSafeSrc(
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4='
      )
    ).toBe(false);
    expect(isSafeSrc('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('should block dangerous schemes', () => {
    expect(isSafeSrc('javascript:alert(1)')).toBe(false);
    expect(isSafeSrc('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeSrc('data:text/javascript,alert(1)')).toBe(false);
  });

  it('should block cases with whitespace or mixed case', () => {
    expect(isSafeSrc('   javascript:alert(1)')).toBe(false);
    expect(isSafeSrc('JAVASCRIPT:alert(1)')).toBe(false);
    expect(isSafeSrc('data:image/svg+xml;utf8,<svg></svg>')).toBe(false);
  });
});

describe('collectLineImages', () => {
  it('should collect Markdown images', () => {
    const text = '![alt](https://example.com/image.png)';
    const results = collectLineImages(text);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ alt: 'alt', src: 'https://example.com/image.png' });
  });

  it('should collect HTML images', () => {
    const text = '<img src="https://example.com/image.png">';
    const results = collectLineImages(text);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ alt: '', src: 'https://example.com/image.png' });
  });

  it('should respect maxPerLine', () => {
    const text = '![1](url1) ![2](url2) ![3](url3) ![4](url4)';
    const results = collectLineImages(text, 2);
    expect(results).toHaveLength(2);
  });

  it('should block lines longer than 1000 characters', () => {
    const longLine = '![alt](' + 'a'.repeat(1000) + ')';
    expect(longLine.length).toBeGreaterThan(1000);
    const results = collectLineImages(longLine);
    expect(results).toHaveLength(0);
  });

  it('should efficiently handle potential ReDoS payloads', () => {
    // Test payload for HTML regex
    const htmlPayload = '<img ' + 'src="a" '.repeat(100) + 'X';
    const startHtml = Date.now();
    collectLineImages(htmlPayload);
    const endHtml = Date.now();
    expect(endHtml - startHtml).toBeLessThan(100);

    // Test payload for Markdown regex
    const mdPayload = '![alt](url' + ' '.repeat(100) + '"title' + ' '.repeat(100);
    const startMd = Date.now();
    collectLineImages(mdPayload);
    const endMd = Date.now();
    expect(endMd - startMd).toBeLessThan(100);
  });

  it('should correctly parse markdown image with title', () => {
    const text = '![alt](url "title")';
    const results = collectLineImages(text);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ alt: 'alt', src: 'url' });
  });
});
