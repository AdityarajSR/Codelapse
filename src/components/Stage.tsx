import { Suspense, lazy, useState } from 'react';
import type { StageModel } from '../stage/model';
import { Stage2D } from '../stage/Stage2D';
import { hasWebGL } from '../stage/webgl';
import { ErrorBoundary } from './ErrorBoundary';

const Stage3D = lazy(() => import('../stage/Stage3D'));

interface StageProps {
  /** Identity-threaded (and carry-forward "sticky") model from TraceView. */
  model: StageModel | null;
}

/** Host for the data-structure stage: WebGL 3D by default (lazy-loaded), flat
 * 2D fallback, manual toggle. Purely presentational — parsing and identity
 * tracking happen once upstream in TraceView. */
export function Stage({ model }: StageProps) {
  const [webgl] = useState(() => hasWebGL());
  const [mode, setMode] = useState<'3d' | '2d'>(webgl ? '3d' : '2d');

  const hint = model ? `${model.name} · ${model.kind}` : 'lists, stacks & dicts as objects';
  const use3d = webgl && mode === '3d';

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
          <ErrorBoundary fallback={<Stage2D model={model} />}>
            <Suspense fallback={<div className="stage__loading">loading 3D…</div>}>
              <Stage3D model={model} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Stage2D model={model} />
        )}
      </div>
    </section>
  );
}
