import { describe, expect, it } from 'vitest';

describe('test runner smoke check', () => {
  it('runs a basic assertion', () => {
    expect(2 + 2).toBe(4);
  });
});
