import { Suspense, lazy, useState } from 'react';
import { Stage2D } from '../stage/Stage2D';
import { pickPrimary } from '../stage/structures';
import { hasWebGL } from '../stage/webgl';
import type { VarSnapshot } from '../types/trace';
import { ErrorBoundary } from './ErrorBoundary';

const Stage3D = lazy(() => import('../stage/Stage3D'));

interface StageProps {
  locals: Record<string, VarSnapshot>;
}

/** Host for the data-structure stage: WebGL 3D by default (lazy-loaded, so it
 * never bloats the initial bundle), with a flat 2D fallback and a manual toggle. */
export function Stage({ locals }: StageProps) {
  const [webgl] = useState(() => hasWebGL());
  const [mode, setMode] = useState<'3d' | '2d'>(webgl ? '3d' : '2d');

  const st = pickPrimary(locals);
  const hint = st ? `${st.name} · ${st.kind}` : 'arrays, stacks & dicts as objects';
  const use3d = webgl && mode === '3d';

  return (
    <section className="stage">
      <div className="stage__head">
        <span className="stage__badge">stage</span>
        <span className="stage__hint">{hint}</span>
        <span className="stage__spacer" />
        {webgl && (
          <button
            className="toggle"
            onClick={() => setMode((m) => (m === '3d' ? '2d' : '3d'))}
            aria-label={`Switch to ${mode === '3d' ? '2D' : '3D'} view`}
          >
            <span className={mode === '3d' ? 'toggle__on' : ''}>3D</span>
            <span className={mode === '2d' ? 'toggle__on' : ''}>2D</span>
          </button>
        )}
      </div>
      <div className={`stage__floor${use3d ? ' stage__floor--3d' : ''}`}>
        {use3d ? (
          <ErrorBoundary fallback={<Stage2D locals={locals} />}>
            <Suspense fallback={<div className="stage__loading">loading 3D…</div>}>
              <Stage3D locals={locals} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Stage2D locals={locals} />
        )}
      </div>
    </section>
  );
}
