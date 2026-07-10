import { useMemo, useRef } from 'react';
import { changedVars } from '../lib/traceModel';
import { buildStageFrames } from '../stage/model';
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

  // Sticky stage frames: each step shows up to two structures at once (so a
  // second string or a companion dict gets stage time too), with element
  // IDENTITY threaded across steps so the stages can animate moves and swaps.
  // Precomputed once per trace — deterministic under scrubbing, and playback
  // ticks stop paying for parsing/diffing entirely.
  const frameByStep = useMemo(() => buildStageFrames(trace), [trace]);
  const frame = frameByStep[index] ?? null;

  return (
    <div className="col col--right">
      {pendingShare && (
        <div className="banner banner--info" role="status">
          <strong>Someone shared this code with you.</strong>
          <span>Press Run to trace it — Codelapse never runs shared code automatically.</span>
        </div>
      )}
      <StatusBanner trace={trace} workerError={workerError} />
      <Stage frame={frame} />
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
