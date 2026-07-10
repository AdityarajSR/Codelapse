import { Suspense, lazy, useState } from 'react';
import type { StageFrame } from '../stage/model';
import { pointerColor } from '../stage/model';
import { Stage2D } from '../stage/Stage2D';
import { hasWebGL } from '../stage/webgl';
import { ErrorBoundary } from './ErrorBoundary';

const Stage3D = lazy(() => import('../stage/Stage3D'));

interface StageProps {
  /** Identity-threaded (and carry-forward "sticky") frame from TraceView. */
  frame: StageFrame | null;
}

/** Host for the data-structure stage: WebGL 3D by default (lazy-loaded), flat
 * 2D fallback, manual toggle. Purely presentational — parsing and identity
 * tracking happen once upstream in TraceView. */
export function Stage({ frame }: StageProps) {
  const [webgl] = useState(() => hasWebGL());
  const [mode, setMode] = useState<'3d' | '2d'>(webgl ? '3d' : '2d');

  const hint = frame?.rows.length
    ? frame.rows
        .map((r) => (r.kind === 'scalars' ? 'variables · live' : `${r.name} · ${r.kind}`))
        .join('  +  ')
    : 'lists, stacks & dicts as objects';
  const use3d = webgl && mode === '3d';
  const pointers = frame?.rows[0]?.pointers ?? [];

  return (
    <section className="stage">
      <div className="stage__head">
        <span className="stage__badge">stage</span>
        <span className="stage__hint">{hint}</span>
        <span className="stage__spacer" />
        {webgl && (
          <div className="toggle" role="group" aria-label="Stage view">
            <button
              className={`toggle__opt${mode === '3d' ? ' toggle__opt--on' : ''}`}
              aria-pressed={mode === '3d'}
              onClick={() => setMode('3d')}
            >
              3D
            </button>
            <button
              className={`toggle__opt${mode === '2d' ? ' toggle__opt--on' : ''}`}
              aria-pressed={mode === '2d'}
              onClick={() => setMode('2d')}
            >
              2D
            </button>
          </div>
        )}
      </div>
      <div className={`stage__floor${use3d ? ' stage__floor--3d' : ''}`}>
        {use3d ? (
          <ErrorBoundary fallback={<Stage2D frame={frame} />}>
            <Suspense fallback={<div className="stage__loading">loading 3D…</div>}>
              <Stage3D frame={frame} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Stage2D frame={frame} />
        )}
        {/* Narrator: what just happened, in code-speak. Keyed by text so each
            new event replays the pop-in. aria-live reads it to screen readers. */}
        {frame?.action && (
          <div className="stage__caption" role="status" aria-live="polite" key={frame.action}>
            {frame.action}
          </div>
        )}
        {/* Legend: what the ▲ markers mean, with each pointer's live value. */}
        {frame && pointers.length > 0 && (
          <div className="stage__legend" aria-hidden="true">
            {pointers.map((p) => (
              <span key={p.name} style={{ color: pointerColor(p.name) }}>
                ▲ {p.name}={p.index}
              </span>
            ))}
            <span className="stage__legendNote">
              — each ▲ marks the position that variable points to in{' '}
              <strong>{frame.rows[0].name}</strong>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
