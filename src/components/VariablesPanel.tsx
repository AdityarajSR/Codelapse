import type { VarSnapshot } from '../types/trace';

interface VariablesPanelProps {
  locals: Record<string, VarSnapshot>;
  /** previous step's locals — used to show old → new on changed values */
  prevLocals?: Record<string, VarSnapshot>;
  changed: Set<string>;
  /** changes each step so a changed row re-mounts and re-runs its flash animation */
  stepKey: number;
}

export function VariablesPanel({ locals, prevLocals, changed, stepKey }: VariablesPanelProps) {
  const names = Object.keys(locals);

  return (
    <section className="panel">
      <h2 className="panel__title">
        <span className="panel__tick panel__tick--vars" aria-hidden="true" />
        Variables
        {names.length > 0 && <span className="panel__count">{names.length}</span>}
      </h2>
      <div className="panel__body">
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
    </section>
  );
}
