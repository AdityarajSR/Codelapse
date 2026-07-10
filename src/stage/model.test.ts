import { describe, expect, it } from 'vitest';
import type { Step, Trace, VarSnapshot } from '../types/trace';
import { buildStageFrames } from './model';

function snap(repr: string, kind: VarSnapshot['kind'], type = 'auto'): VarSnapshot {
  return { repr, type, kind };
}

function list(items: (string | number)[]): VarSnapshot {
  return snap(`[${items.join(', ')}]`, 'array', 'list');
}

function int(v: number): VarSnapshot {
  return snap(String(v), 'scalar', 'int');
}

function str(s: string): VarSnapshot {
  return snap(`'${s}'`, 'string', 'str');
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

/** Primary row of step i (most tests exercise a single structure). */
const row0 = (frames: ReturnType<typeof buildStageFrames>, i: number) => frames[i]!.rows[0];

describe('buildStageFrames — identity threading', () => {
  it('keeps ids stable when nothing changes (and reuses the frame object)', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([1, 2, 3]) }, { a: list([1, 2, 3]) }]));
    expect(frames[0]).toBe(frames[1]); // reference reuse on the hot path
    expect(row0(frames, 0).els.map((e) => e.label)).toEqual(['1', '2', '3']);
  });

  it('tracks a swap as two elements exchanging slots', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([5, 2, 8]) }, { a: list([2, 5, 8]) }]));
    const m0 = row0(frames, 0);
    const m1 = row0(frames, 1);
    expect(m1.els.map((e) => e.id)).toEqual([m0.els[1].id, m0.els[0].id, m0.els[2].id]);
  });

  it('handles duplicate values: same-slot match wins, then nearest', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([3, 1, 3]) }, { a: list([3, 3, 1]) }]));
    const m0 = row0(frames, 0);
    const m1 = row0(frames, 1);
    expect(m1.els[0].id).toBe(m0.els[0].id);
    expect(m1.els[1].id).toBe(m0.els[2].id);
    expect(m1.els[2].id).toBe(m0.els[1].id);
  });

  it('appends get fresh ids; existing elements keep theirs', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([1, 2]) }, { a: list([1, 2, 9]) }]));
    const m0 = row0(frames, 0);
    const m1 = row0(frames, 1);
    expect(m1.els[0].id).toBe(m0.els[0].id);
    expect(m1.els[1].id).toBe(m0.els[1].id);
    expect(m0.els.some((e) => e.id === m1.els[2].id)).toBe(false);
  });

  it('an in-place overwrite keeps the slot but changes the label (new id)', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([5, 2]) }, { a: list([5, 5]) }]));
    const m0 = row0(frames, 0);
    const m1 = row0(frames, 1);
    expect(m1.els[0].id).toBe(m0.els[0].id); // untouched 5 keeps its box
    expect(m1.els[1].label).toBe('5');
    expect(m1.els[1].id).not.toBe(m0.els[1].id); // the written copy is a new box
  });

  it('resets identities when the featured variable changes', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([1, 2]) }, { b: list([1, 2]) }]));
    expect(row0(frames, 1).name).toBe('b');
    expect(row0(frames, 1).els[0].id).not.toBe(row0(frames, 0).els[0].id);
  });

  it('dict pairs take identity from their key', () => {
    const frames = buildStageFrames(
      mkTrace([
        { d: snap("{'x': 1, 'y': 2}", 'dict', 'dict') },
        { d: snap("{'y': 2, 'x': 1}", 'dict', 'dict') },
      ]),
    );
    expect(row0(frames, 0).els[0].id).toBe(row0(frames, 1).els[1].id); // 'x' moved
    expect(row0(frames, 0).els[0].keyLabel).toBe("'x'");
  });

  it('carries the last frame forward (sticky) when locals lose the structures', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([1, 2]) }, { n: int(2) }]));
    expect(frames[1]).not.toBeNull();
    expect(row0(frames, 1).name).toBe('a');
    expect(row0(frames, 1).els.map((e) => e.label)).toEqual(['1', '2']);
  });
});

describe('buildStageFrames — multiple rows', () => {
  it('shows two structures at once (two strings)', () => {
    const frames = buildStageFrames(mkTrace([{ a: str('hey'), b: str('you') }]));
    expect(frames[0]!.rows.map((r) => r.name)).toEqual(['a', 'b']);
    expect(frames[0]!.rows[1].els.map((e) => e.label)).toEqual(['y', 'o', 'u']);
  });

  it('shows an array with its companion dict (two-sum shape)', () => {
    const frames = buildStageFrames(
      mkTrace([{ nums: list([2, 7, 11]), seen: snap("{'2': 0}", 'dict', 'dict') }]),
    );
    expect(frames[0]!.rows.map((r) => r.kind)).toEqual(['array', 'dict']);
    expect(frames[0]!.rows.map((r) => r.name)).toEqual(['nums', 'seen']);
  });

  it('caps at two rows, keeping the best-scoring structures', () => {
    const frames = buildStageFrames(
      mkTrace([{ a: list([1, 2, 3]), d: snap("{'x': 1}", 'dict', 'dict'), s: str('zz') }]),
    );
    expect(frames[0]!.rows.map((r) => r.name)).toEqual(['a', 'd']); // string loses
  });

  it('keeps row order stable when scores shift (first-seen keeps its lane)', () => {
    const frames = buildStageFrames(
      mkTrace([
        { a: list([1]), d: snap("{'x': 1}", 'dict', 'dict') },
        { a: list([1]), d: snap("{'x': 1, 'y': 2, 'z': 3}", 'dict', 'dict') },
      ]),
    );
    expect(frames[0]!.rows.map((r) => r.name)).toEqual(['a', 'd']);
    expect(frames[1]!.rows.map((r) => r.name)).toEqual(['a', 'd']); // no lane swap
  });

  it('threads identity per variable — both rows animate their own moves', () => {
    const frames = buildStageFrames(
      mkTrace([
        { a: list([5, 2]), b: list([9, 4]) },
        { a: list([2, 5]), b: list([4, 9]) },
      ]),
    );
    const [a0, b0] = frames[0]!.rows;
    const [a1, b1] = frames[1]!.rows;
    expect(a1.els.map((e) => e.id)).toEqual([a0.els[1].id, a0.els[0].id]); // a swapped
    expect(b1.els.map((e) => e.id)).toEqual([b0.els[1].id, b0.els[0].id]); // b swapped too
  });
});

describe('buildStageFrames — index pointers', () => {
  it('shows int locals that index into the primary structure', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([9, 8, 7]), i: int(0), j: int(2) }]));
    expect(row0(frames, 0).pointers).toEqual([
      { name: 'i', index: 0 },
      { name: 'j', index: 2 },
    ]);
  });

  it('excludes out-of-range ints and non-scalars', () => {
    const frames = buildStageFrames(mkTrace([{ a: list([9, 8, 7]), n: int(3), neg: int(-1) }]));
    expect(row0(frames, 0).pointers).toEqual([]);
  });

  it('caps pointers at 4, preferring shorter names', () => {
    const frames = buildStageFrames(
      mkTrace([
        { a: list([9, 8, 7, 6]), i: int(0), j: int(1), k: int(2), lo: int(3), total: int(1) },
      ]),
    );
    expect(row0(frames, 0).pointers.map((p) => p.name)).toEqual(['i', 'j', 'k', 'lo']);
  });

  it('drops stale pointers on carried-forward structures', () => {
    const frames = buildStageFrames(
      mkTrace([{ a: list([1, 2]), i: int(1) }, { done: snap('True', 'scalar', 'bool') }]),
    );
    expect(row0(frames, 0).pointers).toEqual([{ name: 'i', index: 1 }]);
    expect(row0(frames, 1).pointers).toEqual([]); // i is out of scope now
  });

  it('no pointers on dicts, sets, or secondary rows', () => {
    const frames = buildStageFrames(
      mkTrace([{ a: list([9, 8]), s: str('xy'), i: int(0), d: snap("{'x': 1}", 'dict', 'dict') }]),
    );
    // rows: a (array) + d (dict); only a carries the pointer
    expect(frames[0]!.rows[0].pointers).toEqual([{ name: 'i', index: 0 }]);
    expect(frames[0]!.rows[1].pointers).toEqual([]);
  });
});

describe('buildStageFrames — action narrator', () => {
  const actions = (localsPerStep: Record<string, VarSnapshot>[]) =>
    buildStageFrames(mkTrace(localsPerStep)).map((f) => f?.action ?? null);

  it('introduces the structure on first sight', () => {
    expect(actions([{ a: list([1, 2, 3]) }])).toEqual(['watching a (3 items)']);
  });

  it('narrates a swap', () => {
    expect(actions([{ a: list([5, 2, 8]) }, { a: list([2, 5, 8]) }])[1]).toBe(
      'swapped a[0] ⇄ a[1]',
    );
  });

  it('narrates an in-place write', () => {
    expect(actions([{ a: list([5, 2]) }, { a: list([5, 7]) }])[1]).toBe('a[1] = 7');
  });

  it('narrates append, insert, pop and remove', () => {
    expect(actions([{ a: list([1, 2]) }, { a: list([1, 2, 9]) }])[1]).toBe('appended 9');
    expect(actions([{ a: list([1, 2]) }, { a: list([1, 7, 2]) }])[1]).toBe('inserted 7 at a[1]');
    expect(actions([{ a: list([1, 2, 3]) }, { a: list([1, 2]) }])[1]).toBe('popped 3');
    expect(actions([{ a: list([1, 2, 3]) }, { a: list([2, 3]) }])[1]).toBe('removed a[0]');
  });

  it('stays sticky through quiet steps and carried structures', () => {
    const acts = actions([
      { a: list([5, 2]) },
      { a: list([2, 5]) },
      { a: list([2, 5]) }, // quiet step — keep narrating the swap
      { n: int(1) }, // structure carried — still keep it
    ]);
    expect(acts[1]).toBe('swapped a[0] ⇄ a[1]');
    expect(acts[2]).toBe('swapped a[0] ⇄ a[1]');
    expect(acts[3]).toBe('swapped a[0] ⇄ a[1]');
  });

  it('narrates the secondary row when only it changed', () => {
    const acts = actions([
      { nums: list([2, 7]), seen: snap('{}', 'dict', 'dict') },
      { nums: list([2, 7]), seen: snap("{'2': 0}", 'dict', 'dict') },
    ]);
    expect(acts[1]).toBe("added '2': 0");
  });

  it('narrates dict adds, value changes and removals', () => {
    const d = (repr: string) => snap(repr, 'dict', 'dict');
    expect(actions([{ d: d("{'x': 1}") }, { d: d("{'x': 1, 'y': 2}") }])[1]).toBe("added 'y': 2");
    expect(actions([{ d: d("{'x': 1}") }, { d: d("{'x': 5}") }])[1]).toBe("d['x'] = 5");
    expect(actions([{ d: d("{'x': 1, 'y': 2}") }, { d: d("{'x': 1}") }])[1]).toBe("removed 'y'");
  });

  it('narrates set adds and string changes', () => {
    const st = (repr: string) => snap(repr, 'set', 'set');
    expect(actions([{ s: st('{1, 2}') }, { s: st('{1, 2, 3}') }])[1]).toBe('added 3');
    expect(actions([{ w: str('hi') }, { w: str('hip') }])[1]).toBe('w = "hip"');
  });
});
