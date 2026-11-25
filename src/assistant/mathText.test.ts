import { describe, expect, it } from 'vitest';
import { plainMath, speakMath } from './mathText';
import { toSpeakable } from './speech';

describe('plainMath (screen)', () => {
  it.each([
    ['Time: $O(n^2)$', 'Time: O(n²)'],
    ['Time: $O(n \\log n)$', 'Time: O(n log n)'],
    ['Space: $O(1)$.', 'Space: O(1).'],
    ['$$O(2^{n})$$', 'O(2ⁿ)'],
    ['it is \\(O(\\log n)\\)', 'it is O(log n)'],
    ['bare O(n^2) too', 'bare O(n²) too'],
    ['$i \\le n$', 'i ≤ n'],
  ])('%s → %s', (input, out) => {
    expect(plainMath(input)).toBe(out);
  });

  it('leaves money and code blocks alone', () => {
    expect(plainMath('costs $5 and $10')).toBe('costs $5 and $10');
    const code = '```python\nprint("$x$")\n```';
    expect(plainMath(code)).toBe(code);
  });
});

describe('speakMath (voice)', () => {
  it.each([
    ['O(n)', 'big O of n'],
    ['O(n²)', 'big O of n squared'],
    ['O(n^2)', 'big O of n squared'],
    ['O(log n)', 'big O of log n'],
    ['O(n log n)', 'big O of n log n'],
    ['O(1)', 'big O of 1'],
    ['O(2^n)', 'big O of 2 to the power n'],
    ['O(n * m)', 'big O of n times m'],
    ['while left <= right', 'while left less than or equal to right'],
    ['if a != b', 'if a not equal to b'],
    ['x == 3', 'x equals 3'],
    ['mid = (left + right) // 2', 'mid = (left + right) floor divided by 2'],
    ['seq[i - 1]', 'seq at index i minus 1'],
    ['numbers[mid]', 'numbers at index mid'],
    ['n × (n - 1) / 2', 'n times (n minus 1) divided by 2'],
  ])('%s → %s', (input, out) => {
    expect(speakMath(input)).toBe(out);
  });
});

describe('toSpeakable with math', () => {
  it('reads a complexity answer like a teacher', () => {
    const md =
      '**Time complexity:** $O(n^2)$ because of the nested loops.\n- **Space:** `O(1)`\n- Loop runs while `left <= right`';
    expect(toSpeakable(md)).toBe(
      'Time complexity: big O of n squared because of the nested loops. Space: big O of 1. Loop runs while left less than or equal to right.',
    );
  });
});
