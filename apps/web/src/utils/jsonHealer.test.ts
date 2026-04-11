import { describe, it, expect } from 'vitest';
import { healJSON } from './jsonHealer';

describe('JSONHealer', () => {
  it('should fix missing brackets', () => {
    const res1 = healJSON('{"a": [1, 2');
    expect(res1.data).toEqual({ a: [1, 2] });

    const res2 = healJSON('[{"a": 1');
    expect(res2.data).toEqual([{ a: 1 }]);

    // Testing unescaped strings or strings with brackets inside
    const res3 = healJSON('{"a": "hello{world"');
    expect(res3.data).toEqual({ a: "hello{world" });
  });
});
