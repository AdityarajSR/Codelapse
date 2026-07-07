import { useMemo, useRef } from 'react';
import { changedVars } from '../lib/traceModel';
import { pickPrimary, type Structure } from '../stage/structures';
import { usePlayback } from '../state/playbackStore';
import type { Step, VarSnapshot } from '../types/trace';
import { CallStackPanel } from './CallStackPanel';
import { OutputPanel } from './OutputPanel';
import { Stage } from './Stage';
import { StatusBanner } from './StatusBanner';
import { VariablesPanel } from './VariablesPanel';

const NO_STEPS: Step[] = [];
const EMPTY_LOCALS: Record<string, VarSnapshot> = {};

/**
 * Incremental cumulative stdout: O(delta) while stepping forward (the hot path
 * during playback); full recompute only on a new trace or a backward seek.
 */
function useCumulativeStdout(steps: Step[], index: number): string {
  const cache = useRef<{ steps: Step[] | null; upto: number; text: string }>({
    steps: null,
    upto: -1,
    text: '',
  });
  return useMemo(() => {
    const c = cache.current;
    const end = Math.min(index, steps.length - 1);
    if (c.steps !== steps || end < c.upto) {
      let text = '';
      for (let i = 0; i <= end; i++) text += steps[i].stdout;
      cache.current = { steps, upto: end, text };
      return text;
    }
    let text = c.text;
    for (let i = c.upto + 1; i <= end; i++) text += steps[i].stdout;
    cache.current = { steps, upto: end, text };
    return text;
  }, [steps, index]);
}

interface TraceViewProps {
  pendingShare: boolean;
  workerError: string | null;
}

/**
 * The only part of the app (besides the playback bar and the editor's active
 * line) that subscribes to the playback index — so a 16×-speed run re-renders
 * this column, not the whole tree.
 */
export function TraceView({ pendingShare, workerError }: TraceViewProps) {
  const trace = usePlayback((s) => s.trace);
  const index = usePlayback((s) => s.index);

  const steps = trace?.steps ?? NO_STEPS;
  const current = steps[index];
  const previous = index > 0 ? steps[index - 1] : undefined;

  const changed = useMemo(() => changedVars(previous, current), [previous, current]);
  const stdout = useCumulativeStdout(steps, index);

  // Sticky stage: each step shows the most recent structure seen up to that
  // point, so when a function returns (locals go out of scope) the 3D objects
  // stay on stage instead of vanishing. Precomputed once per trace — carry-
  // forward is deterministic under scrubbing, and playback ticks stop paying
  // for structure parsing entirely.
  const stByStep = useMemo<(Structure | null)[]>(() => {
    if (!trace) return [];
    const arr: (Structure | null)[] = new Array(trace.steps.length);
    let last: Structure | null = null;
    for (let i = 0; i < trace.steps.length; i++) {
      const parsed = pickPrimary(trace.steps[i].locals);
      if (parsed) last = parsed;
      arr[i] = last;
    }
    return arr;
  }, [trace]);
  const st = stByStep[index] ?? null;

  return (
    <div className="col col--right">
      {pendingShare && (
        <div className="banner banner--info" role="status">
          <strong>Someone shared this code with you.</strong>
          <span>Press Run to trace it — Codelapse never runs shared code automatically.</span>
        </div>
      )}
      <StatusBanner trace={trace} workerError={workerError} />
      <Stage st={st} />
      <div className="panels">
        <VariablesPanel
          locals={current?.locals ?? EMPTY_LOCALS}
          prevLocals={previous?.locals}
          changed={changed}
          stepKey={index}
        />
        <OutputPanel text={stdout} />
        <CallStackPanel frames={current?.callStack ?? NO_FRAMES} />
      </div>
    </div>
  );
}

const NO_FRAMES: Step['callStack'] = [];
