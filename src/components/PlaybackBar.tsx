import { type CSSProperties, useEffect } from 'react';
import { usePlayback } from '../state/playbackStore';

const SPEEDS = [1, 2, 4, 8, 16];

export function PlaybackBar() {
  const trace = usePlayback((s) => s.trace);
  const index = usePlayback((s) => s.index);
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const toggle = usePlayback((s) => s.toggle);
  const stepForward = usePlayback((s) => s.stepForward);
  const stepBack = usePlayback((s) => s.stepBack);
  const seek = usePlayback((s) => s.seek);
  const setSpeed = usePlayback((s) => s.setSpeed);

  const total = trace?.steps.length ?? 0;
  const last = Math.max(0, total - 1);
  const disabled = total === 0;
  const line = trace?.steps[index]?.line;

  // Auto-advance ticker. State lives in the trace, so a plain interval is safe.
  useEffect(() => {
    if (!playing) return;
    const ms = Math.max(50, 1000 / speed);
    const id = window.setInterval(() => usePlayback.getState().stepForward(), ms);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  const progress = last > 0 ? (index / last) * 100 : 0;

  return (
    <div className="playbar">
      <div className="playbar__controls">
        <button className="icon-btn" onClick={stepBack} disabled={disabled} aria-label="Step back">
          <span className="i i-prev" aria-hidden="true" />
        </button>
        <button
          className="icon-btn icon-btn--primary"
          onClick={toggle}
          disabled={disabled}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <span className={`i ${playing ? 'i-pause' : 'i-play'}`} aria-hidden="true" />
        </button>
        <button
          className="icon-btn"
          onClick={stepForward}
          disabled={disabled}
          aria-label="Step forward"
        >
          <span className="i i-next" aria-hidden="true" />
        </button>
      </div>

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
      />

      <div className="playbar__meta">
        <span className="playbar__step">{disabled ? '—' : `${index + 1} / ${total}`}</span>
        {line != null && <span className="playbar__line">line {line}</span>}
      </div>

      <label className="speed">
        <span className="sr-only">Speed</span>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          disabled={disabled}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
