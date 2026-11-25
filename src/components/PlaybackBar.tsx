import { type CSSProperties, useEffect, useMemo } from 'react';
import { usePlayback } from '../state/playbackStore';
import {
  JumpBackIcon,
  JumpForwardIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
} from './Icons';

const SPEEDS = [1, 2, 4, 8, 16];

interface Tick {
  i: number;
  type: 'call' | 'out' | 'err';
  pct: number;
}

export function PlaybackBar() {
  const trace = usePlayback((s) => s.trace);
  const index = usePlayback((s) => s.index);
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const toggle = usePlayback((s) => s.toggle);
  const stepForward = usePlayback((s) => s.stepForward);
  const stepBack = usePlayback((s) => s.stepBack);
  const jumpChange = usePlayback((s) => s.jumpChange);
  const seek = usePlayback((s) => s.seek);
  const setSpeed = usePlayback((s) => s.setSpeed);

  const total = trace?.steps.length ?? 0;
  const last = Math.max(0, total - 1);
  const disabled = total === 0;
  const line = trace?.steps[index]?.line;

  // Event markers on the timeline: function calls, prints, and the error step —
  // the scrubber becomes a readable map of the run, not a bare slider.
  const ticks = useMemo<Tick[]>(() => {
    if (!trace || trace.steps.length < 2) return [];
    const steps = trace.steps;
    const n = steps.length;
    const stride = Math.max(1, Math.ceil(n / 240));
    const out: Tick[] = [];
    for (let i = 0; i < n; i++) {
      const s = steps[i];
      const type: Tick['type'] | null =
        s.event === 'exception' ? 'err' : s.event === 'call' ? 'call' : s.stdout ? 'out' : null;
      if (!type) continue;
      if (type !== 'err' && stride > 1 && i % stride !== 0) continue;
      out.push({ i, type, pct: (i / (n - 1)) * 100 });
    }
    if (trace.status === 'runtime-error' && n > 1) {
      out.push({ i: n - 1, type: 'err', pct: 100 });
    }
    return out;
  }, [trace]);

  // Auto-advance ticker on a rAF accumulator: frame-aligned commits, no drift,
  // and it pauses automatically when the tab is hidden (setInterval doesn't).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let acc = 0;
    let prev = performance.now();
    const loop = (t: number) => {
      acc += t - prev;
      prev = t;
      const ms = Math.max(50, 1000 / speed);
      while (acc >= ms) {
        acc -= ms;
        usePlayback.getState().stepForward();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const progress = last > 0 ? (index / last) * 100 : 0;

  return (
    <div className="playbar">
      <div className="playbar__controls">
        <button
          className="icon-btn"
          onClick={() => jumpChange(-1)}
          disabled={disabled}
          title="Previous change (Shift+←)"
          aria-label="Previous change"
        >
          <JumpBackIcon size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={stepBack}
          disabled={disabled}
          title="Step back (←)"
          aria-label="Step back"
        >
          <StepBackIcon size={17} />
        </button>
        <button
          className={`icon-btn icon-btn--primary${playing ? ' is-playing' : ''}`}
          onClick={toggle}
          disabled={disabled}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon size={19} /> : <PlayIcon size={19} />}
        </button>
        <button
          className="icon-btn"
          onClick={stepForward}
          disabled={disabled}
          title="Step forward (→)"
          aria-label="Step forward"
        >
          <StepForwardIcon size={17} />
        </button>
        <button
          className="icon-btn"
          onClick={() => jumpChange(1)}
          disabled={disabled}
          title="Next change (Shift+→)"
          aria-label="Next change"
        >
          <JumpForwardIcon size={16} />
        </button>
      </div>

      <div className="timeline">
        <input
          className="scrubber"
          style={{ '--progress': `${progress}%` } as CSSProperties}
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={disabled}
          aria-label="Timeline"
          aria-valuetext={
            disabled
              ? 'No run yet'
              : `Step ${index + 1} of ${total}${line != null ? `, line ${line}` : ''}`
          }
        />
        <div className="timeline__ticks" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={`${t.type}:${t.i}`}
              className={`tick tick--${t.type}`}
              style={{ left: `${t.pct}%` }}
            />
          ))}
        </div>
      </div>

      <div className="playbar__meta">
        <span className="playbar__step">
          {disabled ? (
            '—'
          ) : (
            <>
              {index + 1}
              <em> / {total}</em>
            </>
          )}
        </span>
        {line != null && <span className="playbar__line">line {line}</span>}
      </div>

      {/* narrow screens: one button that cycles the speed (see index.css) */}
      <button
        className="speedCycle"
        onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        disabled={disabled}
        aria-label={`Playback speed ${speed}×, tap to change`}
      >
        {speed}×
      </button>

      <div className="speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed__opt${s === speed ? ' speed__opt--on' : ''}`}
            onClick={() => setSpeed(s)}
            disabled={disabled}
            aria-pressed={s === speed}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
