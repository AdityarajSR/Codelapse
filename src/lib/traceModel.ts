import type { Step } from '../types/trace';

/**
 * Reconstruct cumulative stdout at a given step from per-step deltas.
 * Deltas keep memory linear (see PLAN.md §9.3); we recompute the prefix on read.
 */
export function cumulativeStdout(steps: Step[], upto: number): string {
  let out = '';
  const end = Math.min(upto, steps.length - 1);
  for (let i = 0; i <= end; i++) out += steps[i].stdout;
  return out;
}

/** Names whose value changed (or first appeared) between two steps — used to
 * flash just-changed variables. */
export function changedVars(prev: Step | undefined, cur: Step | undefined): Set<string> {
  const changed = new Set<string>();
  if (!cur) return changed;
  const before = prev?.locals ?? {};
  for (const [name, snap] of Object.entries(cur.locals)) {
    const prior = before[name];
    if (!prior || prior.repr !== snap.repr) changed.add(name);
  }
  return changed;
}
