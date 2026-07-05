import type { Structure } from './structures';

interface Stage2DProps {
  st: Structure | null;
}

/** Flat fallback (and the "2D" toggle) for the data-structure stage. */
export function Stage2D({ st }: Stage2DProps) {
  if (!st) {
    return (
      <div className="stage__placeholder">
        <span className="stage__cube" aria-hidden="true" />
        <p>Run code with a list, dict, or string to see it here.</p>
      </div>
    );
  }

  if (st.kind === 'dict') {
    return (
      <div className="tiles">
        {st.pairs.map(([k, v], i) => (
          <div
            className="tile tile--kv"
            key={`${i}:${k}`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="tile__k">{k}</span>
            <span className="tile__v">{v}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tiles">
      {st.items.map((v, i) => (
        <div
          className={`tile${i === st.items.length - 1 ? ' tile--head' : ''}`}
          key={`${i}:${v}`}
          style={{ animationDelay: `${i * 45}ms` }}
        >
          {v}
        </div>
      ))}
    </div>
  );
}
