import type { RunPhase } from '../runtime/useRunner';
import type { Example } from '../examples';
import type { Language } from '../types/trace';
import { BrandMark, PlayIcon, ShareIcon } from './Icons';
import { NavFact } from './NavFact';
import { Select, type SelectOption } from './Select';

interface HeaderProps {
  phase: RunPhase;
  language: Language;
  onPickLanguage: (lang: Language) => void;
  onRun: () => void;
  onShare: () => void;
  examples: Example[];
  currentExampleId: string;
  onPickExample: (id: string) => void;
}

const runLabel: Record<RunPhase, string> = {
  idle: 'Run',
  booting: 'Loading engine…',
  running: 'Running…',
  done: 'Run',
  error: 'Run',
};

const LANG_OPTIONS: SelectOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java', disabled: true, group: 'Coming soon — server tier' },
  { value: 'c', label: 'C', disabled: true, group: 'Coming soon — server tier' },
  { value: 'cpp', label: 'C++', disabled: true, group: 'Coming soon — server tier' },
];

export function Header({
  phase,
  language,
  onPickLanguage,
  onRun,
  onShare,
  examples,
  currentExampleId,
  onPickExample,
}: HeaderProps) {
  const busy = phase === 'booting' || phase === 'running';
  const exampleOptions: SelectOption[] = examples.map((ex) => ({ value: ex.id, label: ex.title }));

  return (
    <header className="header">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <BrandMark size={26} />
        </span>
        <span className="brand__name">
          Code<b>lapse</b>
        </span>
      </div>

      <Select
        className="langSelect"
        value={language}
        options={LANG_OPTIONS}
        onChange={(v) => onPickLanguage(v as Language)}
        ariaLabel="Language"
      />

      <NavFact />

      <div className="header__spacer" />

      <Select
        className="exampleSelect"
        value={currentExampleId}
        options={exampleOptions}
        onChange={onPickExample}
        ariaLabel="Choose an example"
      />

      <span
        className="badge"
        title="Your code runs in your browser via WebAssembly — nothing is uploaded."
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
