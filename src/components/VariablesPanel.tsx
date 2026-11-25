import { useCollapsed } from '../hooks/useCollapsed';
import type { VarSnapshot } from '../types/trace';
import { PanelTitle } from './Collapsible';

interface VariablesPanelProps {
  locals: Record<string, VarSnapshot>;
  /** previous step's locals — used to show old → new on changed values */
  prevLocals?: Record<string, VarSnapshot>;
  changed: Set<string>;
  /** changes each step so a changed row re-mounts and re-runs its flash animation */
  stepKey: number;
}

export function VariablesPanel({ locals, prevLocals, changed, stepKey }: VariablesPanelProps) {
  const [collapsed, toggle] = useCollapsed('vars');
  const names = Object.keys(locals);

  return (
    <section className={`panel${collapsed ? ' panel--collapsed' : ''}`}>
      <PanelTitle
        bodyId="panel-vars"
        collapsed={collapsed}
        onToggle={toggle}
        tick="vars"
        title="Variables"
        badge={names.length > 0 ? names.length : undefined}
      />
      {!collapsed && (
        <div className="panel__body" id="panel-vars">
          {names.length === 0 ? (
            <p className="empty">Nothing in scope yet — press Run to trace your code.</p>
          ) : (
            <ul className="vars">
              {names.map((name) => {
                const snap = locals[name];
                const prev = prevLocals?.[name];
                const flash = changed.has(name);
                // old → new is the pedagogically premium moment; only when short
                // enough to stay readable on one row.
                const showOld =
                  flash &&
                  prev != null &&
                  prev.repr !== snap.repr &&
                  prev.repr.length <= 16 &&
                  snap.repr.length <= 20;
                return (
                  <li
                    key={flash ? `${name}:${stepKey}` : name}
                    className={`var${flash ? ' var--flash' : ''}`}
                  >
                    <span className="var__name">
                      <i className={`kdot kdot--${snap.kind}`} aria-hidden="true" />
                      {name}
                      {flash && (
                        <span className="var__delta" aria-label="changed">
                          ▲
                        </span>
                      )}
                    </span>
                    <span className="var__type">{snap.type}</span>
                    <span className="var__val">
                      {showOld && <s className="var__old">{prev.repr}</s>}
                      {snap.repr}
                    </span>
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
