import { describe, expect, it } from 'vitest';
import type { Step, Trace, VarSnapshot } from '../types/trace';
import { buildStageModels } from './model';

function snap(repr: string, kind: VarSnapshot['kind'], type = 'auto'): VarSnapshot {
  return { repr, type, kind };
}

function list(items: (string | number)[]): VarSnapshot {
  return snap(`[${items.join(', ')}]`, 'array', 'list');
}

function int(v: number): VarSnapshot {
  return snap(String(v), 'scalar', 'int');
}

function mkTrace(localsPerStep: Record<string, VarSnapshot>[]): Trace {
  const steps: Step[] = localsPerStep.map((locals, i) => ({
    stepIndex: i,
    line: i + 1,
    funcName: '<module>',
    event: 'line',
    callStack: [],
    locals,
    stdout: '',
  }));
  return {
    schemaVersion: 1,
    language: 'python',
    site: 'browser',
    status: 'ok',
    diagnostics: [],
    steps,
    runtimeVersion: 'test',
  };
}

describe('buildStageModels — identity threading', () => {
  it('keeps ids stable when nothing changes (and reuses the model object)', () => {
    const models = buildStageModels(mkTrace([{ a: list([1, 2, 3]) }, { a: list([1, 2, 3]) }]));
    expect(models[0]).toBe(models[1]); // reference reuse on the hot path
    expect(models[0]!.els.map((e) => e.label)).toEqual(['1', '2', '3']);
  });

  it('tracks a swap as two elements exchanging slots', () => {
    const models = buildStageModels(mkTrace([{ a: list([5, 2, 8]) }, { a: list([2, 5, 8]) }]));
    const [m0, m1] = models as [NonNullable<(typeof models)[0]>, NonNullable<(typeof models)[0]>];
    const id5 = m0.els[0].id;
    const id2 = m0.els[1].id;
    const id8 = m0.els[2].id;
    expect(m1.els.map((e) => e.id)).toEqual([id2, id5, id8]); // 2 and 5 crossed
  });

  it('handles duplicate values: same-slot match wins, then nearest', () => {
    // [3, 1, 3] -> [3, 3, 1]: slot0 keeps its 3; slot1's new 3 takes the
    // nearest free 3 (old slot2); the 1 moves from slot1 to slot2.
    const models = buildStageModels(mkTrace([{ a: list([3, 1, 3]) }, { a: list([3, 3, 1]) }]));
    const [m0, m1] = models as [NonNullable<(typeof models)[0]>, NonNullable<(typeof models)[0]>];
    expect(m1.els[0].id).toBe(m0.els[0].id);
    expect(m1.els[1].id).toBe(m0.els[2].id);
    expect(m1.els[2].id).toBe(m0.els[1].id);
  });

  it('appends get fresh ids; existing elements keep theirs', () => {
    const models = buildStageModels(mkTrace([{ a: list([1, 2]) }, { a: list([1, 2, 9]) }]));
    const [m0, m1] = models as [NonNullable<(typeof models)[0]>, NonNullable<(typeof models)[0]>];
    expect(m1.els[0].id).toBe(m0.els[0].id);
    expect(m1.els[1].id).toBe(m0.els[1].id);
    expect(m0.els.some((e) => e.id === m1.els[2].id)).toBe(false);
  });

  it('an in-place overwrite keeps the slot but changes the label (new id)', () => {
    // insertion-sort shift: [5, 2] -> [5, 5]
    const models = buildStageModels(mkTrace([{ a: list([5, 2]) }, { a: list([5, 5]) }]));
    const [m0, m1] = models as [NonNullable<(typeof models)[0]>, NonNullable<(typeof models)[0]>];
    expect(m1.els[0].id).toBe(m0.els[0].id); // untouched 5 keeps its box
    expect(m1.els[1].label).toBe('5');
    expect(m1.els[1].id).not.toBe(m0.els[1].id); // the written copy is a new box
  });

  it('resets identities when the featured variable changes', () => {
    const models = buildStageModels(mkTrace([{ a: list([1, 2]) }, { b: list([1, 2]) }]));
    const [m0, m1] = models as [NonNullable<(typeof models)[0]>, NonNullable<(typeof models)[0]>];
    expect(m1.name).toBe('b');
    expect(m1.els[0].id).not.toBe(m0.els[0].id);
  });

  it('dict pairs take identity from their key', () => {
    const models = buildStageModels(
      mkTrace([
        { d: snap("{'x': 1, 'y': 2}", 'dict', 'dict') },
        { d: snap("{'y': 2, 'x': 1}", 'dict', 'dict') },
      ]),
    );
    const [m0, m1] = models as [NonNullable<(typeof models)[0]>, NonNullable<(typeof models)[0]>];
    expect(m0.els[0].id).toBe(m1.els[1].id); // 'x' moved, same identity
    expect(m0.els[0].keyLabel).toBe("'x'");
  });

  it('carries the last structure forward (sticky) when locals lose it', () => {
    const models = buildStageModels(mkTrace([{ a: list([1, 2]) }, { n: int(2) }]));
    expect(models[1]).not.toBeNull();
    expect(models[1]!.name).toBe('a');
    expect(models[1]!.els.map((e) => e.label)).toEqual(['1', '2']);
  });
});

describe('buildStageModels — index pointers', () => {
  it('shows int locals that index into the featured array', () => {
    const models = buildStageModels(mkTrace([{ a: list([9, 8, 7]), i: int(0), j: int(2) }]));
    expect(models[0]!.pointers).toEqual([
      { name: 'i', index: 0 },
      { name: 'j', index: 2 },
    ]);
  });

  it('excludes out-of-range ints, non-scalars, and the structure itself', () => {
    const models = buildStageModels(
      mkTrace([{ a: list([9, 8, 7]), n: int(3), neg: int(-1), s: snap("'hi'", 'string') }]),
    );
    expect(models[0]!.pointers).toEqual([]);
  });

  it('caps pointers at 4, preferring shorter names', () => {
    const models = buildStageModels(
      mkTrace([
        {
          a: list([9, 8, 7, 6]),
          i: int(0),
          j: int(1),
          k: int(2),
          lo: int(3),
          total: int(1),
        },
      ]),
    );
    expect(models[0]!.pointers.map((p) => p.name)).toEqual(['i', 'j', 'k', 'lo']);
  });

  it('drops stale pointers on carried-forward structures', () => {
    const models = buildStageModels(
      mkTrace([{ a: list([1, 2]), i: int(1) }, { done: snap('True', 'scalar', 'bool') }]),
    );
    expect(models[0]!.pointers).toEqual([{ name: 'i', index: 1 }]);
    expect(models[1]!.pointers).toEqual([]); // i is out of scope now
  });

  it('no pointers on dicts or sets', () => {
    const models = buildStageModels(mkTrace([{ d: snap("{'x': 1}", 'dict', 'dict'), i: int(0) }]));
    expect(models[0]!.pointers).toEqual([]);
  });
});
