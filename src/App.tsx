import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Coachmarks } from './components/Coachmarks';
import { EditorCard } from './components/EditorCard';
import { Header } from './components/Header';
import { PlaybackBar } from './components/PlaybackBar';
import { TraceView } from './components/TraceView';
import { defaultExample, examples } from './examples';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { decodeShare } from './lib/share';
import { useRunner } from './runtime/useRunner';
import { usePlayback } from './state/playbackStore';

// Loaded on demand — keeps qrcode/gifenc out of the entry chunk, and the
// dialog stops existing (and re-rendering) entirely while closed.
const ShareDialog = lazy(() =>
  import('./components/ShareDialog').then((m) => ({ default: m.ShareDialog })),
);

export default function App() {
  useKeyboardShortcuts();

  const initial = useMemo(() => decodeShare(window.location.hash), []);

  const [code, setCode] = useState(() => (initial ? initial.source : defaultExample.code));
  const [exampleId, setExampleId] = useState(defaultExample.id);
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
  // the built-in example. Only the built-in example is ever auto-run.
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
      run(defaultExample.code);
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
    run(code);
  };
  const onPickExample = (id: string) => {
    const ex = examples.find((e) => e.id === id);
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
        onRun={onRun}
        onShare={() => setShareOpen(true)}
        examples={examples}
        currentExampleId={exampleId}
        onPickExample={onPickExample}
      />

      <main className="workspace">
        <div className="col col--editor">
          <EditorCard code={code} onChange={setCode} />
        </div>
        <TraceView pendingShare={pendingShare} workerError={error} />
      </main>

      <PlaybackBar />

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareDialog onClose={() => setShareOpen(false)} source={code} />
        </Suspense>
      )}

      <Coachmarks />
    </div>
  );
}
