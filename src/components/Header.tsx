import type { RunPhase } from '../runtime/useRunner';
import type { Example } from '../examples';

interface HeaderProps {
  phase: RunPhase;
  onRun: () => void;
  examples: Example[];
  currentExampleId: string;
  onPickExample: (id: string) => void;
}

const runLabel: Record<RunPhase, string> = {
  idle: 'Run',
  booting: 'Booting Python…',
  running: 'Running…',
  done: 'Run',
  error: 'Run',
};

export function Header({ phase, onRun, examples, currentExampleId, onPickExample }: HeaderProps) {
  const busy = phase === 'booting' || phase === 'running';

  return (
    <header className="header">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true" />
        <span className="brand__name">Codelapse</span>
        <span className="brand__lang">Python</span>
      </div>

      <div className="header__spacer" />

      <label className="examplePicker">
        <span className="sr-only">Choose an example</span>
        <select
          value={currentExampleId}
          onChange={(e) => onPickExample(e.target.value)}
          aria-label="Choose an example"
        >
          {examples.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title}
            </option>
          ))}
        </select>
      </label>

      <span
        className="badge"
        title="Python runs in your browser via WebAssembly — nothing is uploaded."
      >
        <span className="badge__dot" aria-hidden="true" />
        runs in your browser
      </span>

      <button className="btn btn--run" onClick={onRun} disabled={busy} aria-busy={busy}>
        {busy ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <span className="btn__play" aria-hidden="true" />
        )}
        {runLabel[phase]}
      </button>
    </header>
  );
}
