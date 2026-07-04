import type { VarSnapshot } from '../types/trace';

interface VariablesPanelProps {
  locals: Record<string, VarSnapshot>;
  changed: Set<string>;
  /** changes each step so a changed row re-mounts and re-runs its flash animation */
  stepKey: number;
}

export function VariablesPanel({ locals, changed, stepKey }: VariablesPanelProps) {
  const names = Object.keys(locals);

  return (
    <section className="panel">
      <h2 className="panel__title">Variables</h2>
      <div className="panel__body">
        {names.length === 0 ? (
          <p className="empty">Nothing in scope yet — press play to begin.</p>
        ) : (
          <ul className="vars">
            {names.map((name) => {
              const flash = changed.has(name);
              return (
                <li
                  key={flash ? `${name}:${stepKey}` : name}
                  className={`var${flash ? ' var--flash' : ''}`}
                >
                  <span className="var__name">{name}</span>
                  <span className="var__type">{locals[name].type}</span>
                  <span className="var__val">{locals[name].repr}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
