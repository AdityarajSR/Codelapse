import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AssistantPanel } from './components/AssistantPanel';
import { EditorCard } from './components/EditorCard';
import { Header } from './components/Header';
import { Lisa } from './components/Lisa';
import { MobileNav, type MobileView } from './components/MobileNav';
import { PlaybackBar } from './components/PlaybackBar';
import { FirstRunTour } from './components/Tour';
import { TraceView } from './components/TraceView';
import { Workspace } from './components/Workspace';
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

/** Keep in sync with the narrow-screen breakpoint in index.css. */
const MOBILE_QUERY = '(max-width: 900px)';

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

  // Note: nothing auto-plays. The default example's trace loads so every panel
  // has content, but playback waits for the user (see FirstRunTour).

  const [mobileView, setMobileView] = useState<MobileView>('code');

  const onRun = () => {
    setPendingShare(false);
    run(code, language);
    // On narrow screens, jump straight to the visualization after Run.
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileView('visual');
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

  // Lisa wrote a program (or Undo restored one): show it and run it.
  const onUseCode = (next: string, lang: Language) => {
    setLanguage(lang);
    setCode(next);
    setTrace(null);
    setPendingShare(false);
    run(next, lang);
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileView('code');
  };

  const onShowAssistant = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileView('assistant');
  };

  return (
    <div className="app">
      {/* first thing a keyboard / screen-reader user reaches */}
      <a className="skipLink" href="#main">
        Skip to main content
      </a>
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
        lisa={
          <Lisa
            code={code}
            language={language}
            onUseCode={onUseCode}
            onRun={onRun}
            onShowAssistant={onShowAssistant}
          />
        }
      />

      <MobileNav view={mobileView} onChange={setMobileView} />

      <Workspace
        mobileView={mobileView}
        editor={<EditorCard code={code} onChange={setCode} language={language} />}
        assistant={<AssistantPanel code={code} language={language} />}
        right={<TraceView code={code} pendingShare={pendingShare} workerError={error} />}
      />

      <PlaybackBar />

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareDialog onClose={() => setShareOpen(false)} source={code} language={language} />
        </Suspense>
      )}

      <FirstRunTour />
    </div>
  );
}
