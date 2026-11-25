import { useCollapsed } from '../hooks/useCollapsed';
import type { Frame } from '../types/trace';
import { PanelTitle } from './Collapsible';

interface CallStackPanelProps {
  frames: Frame[];
}

export function CallStackPanel({ frames }: CallStackPanelProps) {
  const [collapsed, toggle] = useCollapsed('stack');

  return (
    <section className={`panel${collapsed ? ' panel--collapsed' : ''}`}>
      <PanelTitle
        bodyId="panel-stack"
        collapsed={collapsed}
        onToggle={toggle}
        tick="stack"
        title="Call stack"
        badge={frames.length > 0 ? frames.length : undefined}
      />
      {!collapsed && (
        <div className="panel__body" id="panel-stack">
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
      )}
    </section>
  );
}
