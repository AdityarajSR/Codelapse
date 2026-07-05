import type { Frame } from '../types/trace';

interface CallStackPanelProps {
  frames: Frame[];
}

export function CallStackPanel({ frames }: CallStackPanelProps) {
  return (
    <section className="panel">
      <h2 className="panel__title">
        <span className="panel__tick panel__tick--stack" aria-hidden="true" />
        Call stack
        {frames.length > 0 && <span className="panel__count">{frames.length}</span>}
      </h2>
      <div className="panel__body">
        {frames.length === 0 ? (
          <p className="empty">No frames yet — run your code.</p>
        ) : (
          <ul className="stack">
            {frames.map((f, i) => {
              // Staircase: module at the left edge, each call level one step
              // deeper — the shape of the stack is visible at a glance.
              const depth = Math.min(frames.length - 1 - i, 6);
              return (
                <li
                  key={`${f.funcName}:${i}`}
                  className={`frame${i === 0 ? ' frame--active' : ''}`}
                  style={{ marginLeft: `${depth * 14}px` }}
                >
                  <span className="frame__fn">
                    {f.funcName === '<module>' ? 'module' : `${f.funcName}()`}
                  </span>
                  <span className="frame__line">line {f.line}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
