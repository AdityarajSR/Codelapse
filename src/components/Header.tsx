import type { ReactNode } from 'react';
import type { RunPhase } from '../runtime/useRunner';
import type { Example } from '../examples';
import type { Language } from '../types/trace';
import { BrandMark, PlayIcon } from './Icons';
import { MuteButton } from './MuteButton';
import { NavFact } from './NavFact';
import { Select, type SelectOption } from './Select';

interface HeaderProps {
  phase: RunPhase;
  language: Language;
  onPickLanguage: (lang: Language) => void;
  onRun: () => void;
  examples: Example[];
  currentExampleId: string;
  onPickExample: (id: string) => void;
  /** the header assistant (Lisa) */
  lisa?: ReactNode;
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
  examples,
  currentExampleId,
  onPickExample,
  lisa,
}: HeaderProps) {
  const busy = phase === 'booting' || phase === 'running';
  const exampleOptions: SelectOption[] = examples.map((ex) => ({
    value: ex.id,
    label: ex.title,
    group: ex.group,
  }));

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
        title="Your code runs in your browser via WebAssembly. It is only sent to a server when you ask the AI assistant a question."
      >
        <span className="badge__dot" aria-hidden="true" />
        runs in your browser
      </span>

      {lisa}
      <MuteButton />

      <button className="btn btn--run" onClick={onRun} disabled={busy} aria-busy={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <PlayIcon size={14} />}
        <span className="btn__label">{runLabel[phase]}</span>
      </button>

      {/* narrow screens: forces the second header row (see index.css) */}
      <span className="header__break" aria-hidden="true" />
    </header>
  );
}
