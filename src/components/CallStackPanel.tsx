import type { Frame } from '../types/trace';

interface CallStackPanelProps {
  frames: Frame[];
}

export function CallStackPanel({ frames }: CallStackPanelProps) {
  return (
    <section className="panel">
      <h2 className="panel__title">Call stack</h2>
      <div className="panel__body">
        {frames.length === 0 ? (
          <p className="empty">—</p>
        ) : (
          <ul className="stack">
            {frames.map((f, i) => (
              <li key={`${f.funcName}:${i}`} className={`frame${i === 0 ? ' frame--active' : ''}`}>
                <span className="frame__fn">
                  {f.funcName === '<module>' ? 'module' : `${f.funcName}()`}
                </span>
                <span className="frame__line">line {f.line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
