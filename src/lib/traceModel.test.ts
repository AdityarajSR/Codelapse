import { describe, expect, it } from 'vitest';
import { changedVars, cumulativeStdout } from './traceModel';
import type { Step } from '../types/trace';

function step(partial: Partial<Step> & { stepIndex: number }): Step {
  return {
    line: 1,
    funcName: '<module>',
    event: 'line',
    callStack: [],
    locals: {},
    stdout: '',
    ...partial,
  };
}

describe('cumulativeStdout', () => {
  it('concatenates per-step deltas up to the given index', () => {
    const steps = [
      step({ stepIndex: 0, stdout: 'a' }),
      step({ stepIndex: 1, stdout: 'b' }),
      step({ stepIndex: 2, stdout: 'c' }),
    ];
    expect(cumulativeStdout(steps, 0)).toBe('a');
    expect(cumulativeStdout(steps, 1)).toBe('ab');
    expect(cumulativeStdout(steps, 2)).toBe('abc');
  });

  it('clamps an out-of-range index', () => {
    const steps = [step({ stepIndex: 0, stdout: 'x' })];
    expect(cumulativeStdout(steps, 99)).toBe('x');
  });
});

describe('changedVars', () => {
  const mk = (locals: Record<string, string>): Step =>
    step({
      stepIndex: 0,
      locals: Object.fromEntries(
        Object.entries(locals).map(([k, v]) => [k, { repr: v, type: 'int', kind: 'scalar' }]),
      ),
    });

  it('flags new and changed names, ignores unchanged', () => {
    const prev = mk({ a: '1', b: '2' });
    const cur = mk({ a: '1', b: '3', c: '4' });
    const changed = changedVars(prev, cur);
    expect(changed.has('a')).toBe(false);
    expect(changed.has('b')).toBe(true);
    expect(changed.has('c')).toBe(true);
  });

  it('treats every var as changed when there is no previous step', () => {
    const cur = mk({ a: '1' });
    expect(changedVars(undefined, cur)).toEqual(new Set(['a']));
  });
});
