import type { RunPhase } from '../runtime/useRunner';
import type { Example } from '../examples';
import { BrandMark, PlayIcon, ShareIcon } from './Icons';

interface HeaderProps {
  phase: RunPhase;
  onRun: () => void;
  onShare: () => void;
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

export function Header({
  phase,
  onRun,
  onShare,
  examples,
  currentExampleId,
  onPickExample,
}: HeaderProps) {
  const busy = phase === 'booting' || phase === 'running';

  return (
    <header className="header">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <BrandMark size={26} />
        </span>
        <span className="brand__name">
          Code<b>lapse</b>
        </span>
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

      <a className="header__legal" href="/legal.html" target="_blank" rel="noopener noreferrer">
        Legal
      </a>

      <button className="btn btn--ghost" onClick={onShare}>
        <ShareIcon />
        Share
      </button>

      <button className="btn btn--run" onClick={onRun} disabled={busy} aria-busy={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <PlayIcon size={14} />}
        {runLabel[phase]}
      </button>
    </header>
  );
}
