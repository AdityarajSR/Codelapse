import { useMemo } from 'react';
import type { VarSnapshot } from '../types/trace';

/** Naive flat-array parser — enough for the numeric arrays the seed examples
 * use. The real WebGL stage (Three.js) replaces this teaser. */
function parseFlatArray(repr: string): string[] | null {
  const s = repr.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return null;
  const inner = s.slice(1, -1).trim();
  if (inner === '') return [];
  if (/[[\]{}()]/.test(inner)) return null; // nested — bail
  return inner.split(',').map((x) => x.trim());
}

interface StagePreviewProps {
  locals: Record<string, VarSnapshot>;
}

export function StagePreview({ locals }: StagePreviewProps) {
  const pick = useMemo(() => {
    for (const [name, snap] of Object.entries(locals)) {
      if (snap.kind === 'array') {
        const items = parseFlatArray(snap.repr);
        if (items) return { name, items };
      }
    }
    return null;
  }, [locals]);

  return (
    <section className="stage">
      <div className="stage__head">
        <span className="stage__badge">3D stage</span>
        <span className="stage__hint">
          {pick ? pick.name : 'arrays, stacks & dicts as objects'}
        </span>
      </div>
      <div className="stage__floor">
        {pick && pick.items.length > 0 ? (
          <div className="tiles">
            {pick.items.map((value, i) => (
              <div className="tile" key={`${i}:${value}`} style={{ animationDelay: `${i * 45}ms` }}>
                {value}
              </div>
            ))}
          </div>
        ) : (
          <div className="stage__placeholder">
            <span className="stage__cube" aria-hidden="true" />
            <p>The WebGL data-structure stage lands next.</p>
          </div>
        )}
      </div>
    </section>
  );
}
