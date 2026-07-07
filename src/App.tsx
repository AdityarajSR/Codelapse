import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Coachmarks } from './components/Coachmarks';
import { EditorCard } from './components/EditorCard';
import { Header } from './components/Header';
import { PlaybackBar } from './components/PlaybackBar';
import { TraceView } from './components/TraceView';
import { defaultExampleFor, examplesFor } from './examples';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { decodeShare } from './lib/share';
import { useRunner } from './runtime/useRunner';
import { usePlayback } from './state/playbackStore';
import type { Language } from './types/trace';

// Loaded on demand — keeps qrcode/gifenc out of the entry chunk, and the
// dialog stops existing (and re-rendering) entirely while closed.
const ShareDialog = lazy(() =>
  import('./components/ShareDialog').then((m) => ({ default: m.ShareDialog })),
);

export default function App() {
  useKeyboardShortcuts();

  const initial = useMemo(() => decodeShare(window.location.hash), []);

  const [language, setLanguage] = useState<Language>(() =>
    initial ? (initial.kind === 'trace' ? initial.trace.language : initial.language) : 'python',
  );
  const [code, setCode] = useState(() =>
    initial ? initial.source : defaultExampleFor('python').code,
  );
  const [exampleId, setExampleId] = useState(defaultExampleFor('python').id);
  // Shared *source* opens behind a press-play gate — never auto-run (§9.1).
  const [pendingShare, setPendingShare] = useState(initial?.kind === 'source');
  const [shareOpen, setShareOpen] = useState(false);

  const { phase, trace, error, run } = useRunner();

  const setTrace = usePlayback((s) => s.setTrace);
  const seek = usePlayback((s) => s.seek);
  const play = usePlayback((s) => s.play);

  // Push each new trace (from a run) into the single playback clock.
  useEffect(() => {
    if (trace) setTrace(trace);
  }, [trace, setTrace]);

  // Init: replay a shared trace, wait for shared source (gate), or auto-run
  // the built-in example. Only built-in examples are ever auto-run.
  // Deliberately NOT ref-guarded: under StrictMode the worker from the first
  // effect pass is terminated, so init must re-fire against the live worker —
  // every action here is idempotent.
  useEffect(() => {
    if (initial?.kind === 'trace') {
      setTrace(initial.trace);
      seek(initial.step);
    } else if (initial?.kind === 'source') {
      // press-play gate — do nothing until the user runs it
    } else {
      run(defaultExampleFor('python').code, 'python');
    }
  }, [initial, run, setTrace, seek]);

  // Auto-play the first locally-produced trace for an alive first impression.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (trace && !bootedRef.current) {
      bootedRef.current = true;
      const t = window.setTimeout(() => play(), 450);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [trace, play]);

  const onRun = () => {
    setPendingShare(false);
    run(code, language);
  };

  const onPickLanguage = (lang: Language) => {
    if (lang === language) return;
    const ex = defaultExampleFor(lang);
    setLanguage(lang);
    setExampleId(ex.id);
    setCode(ex.code);
    setTrace(null);
    setPendingShare(false);
    // our own curated example — safe to auto-run (never shared code)
    run(ex.code, lang);
  };

  const onPickExample = (id: string) => {
    const ex = examplesFor(language).find((e) => e.id === id);
    if (!ex) return;
    setExampleId(id);
    setCode(ex.code);
    setTrace(null);
    setPendingShare(false);
  };

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob aurora__blob--1" />
        <span className="aurora__blob aurora__blob--2" />
        <span className="aurora__blob aurora__blob--3" />
      </div>

      <Header
        phase={phase}
        language={language}
        onPickLanguage={onPickLanguage}
        onRun={onRun}
        onShare={() => setShareOpen(true)}
        examples={examplesFor(language)}
        currentExampleId={exampleId}
        onPickExample={onPickExample}
      />

      <main className="workspace">
        <div className="col col--editor">
          <EditorCard code={code} onChange={setCode} language={language} />
        </div>
        <TraceView pendingShare={pendingShare} workerError={error} />
      </main>

      <PlaybackBar />

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareDialog onClose={() => setShareOpen(false)} source={code} language={language} />
        </Suspense>
      )}

      <Coachmarks />
    </div>
  );
}
