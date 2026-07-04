import { useEffect, useMemo, useRef, useState } from 'react';
import { CallStackPanel } from './components/CallStackPanel';
import { CodeEditor } from './components/CodeEditor';
import { Header } from './components/Header';
import { OutputPanel } from './components/OutputPanel';
import { PlaybackBar } from './components/PlaybackBar';
import { ShareDialog } from './components/ShareDialog';
import { Stage } from './components/Stage';
import { StatusBanner } from './components/StatusBanner';
import { VariablesPanel } from './components/VariablesPanel';
import { defaultExample, examples } from './examples';
import { decodeShare } from './lib/share';
import { changedVars, cumulativeStdout } from './lib/traceModel';
import { useRunner } from './runtime/useRunner';
import { usePlayback } from './state/playbackStore';

export default function App() {
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
  const storeTrace = usePlayback((s) => s.trace);
  const index = usePlayback((s) => s.index);

  // Push each new trace (from a run) into the single playback clock.
  useEffect(() => {
    if (trace) setTrace(trace);
  }, [trace, setTrace]);

  // One-time init: replay a shared trace, wait for shared source (gate), or
  // auto-run the built-in example. Only the built-in example is ever auto-run.
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
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

  const steps = useMemo(() => storeTrace?.steps ?? [], [storeTrace]);
  const current = steps[index];
  const previous = index > 0 ? steps[index - 1] : undefined;

  const changed = useMemo(() => changedVars(previous, current), [previous, current]);
  const stdout = useMemo(
    () => (storeTrace ? cumulativeStdout(steps, index) : ''),
    [storeTrace, steps, index],
  );
  const activeLine = current?.line ?? null;

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
          <div className="card card--editor">
            <CodeEditor value={code} onChange={setCode} activeLine={activeLine} />
          </div>
        </div>

        <div className="col col--right">
          {pendingShare && (
            <div className="banner banner--info">
              <strong>Someone shared this code with you.</strong>
              <span>Press Run to trace it — Codelapse never runs shared code automatically.</span>
            </div>
          )}
          <StatusBanner trace={storeTrace} workerError={error} />
          <Stage locals={current?.locals ?? {}} />
          <div className="panels">
            <VariablesPanel locals={current?.locals ?? {}} changed={changed} stepKey={index} />
            <OutputPanel text={stdout} />
            <CallStackPanel frames={current?.callStack ?? []} />
          </div>
        </div>
      </main>

      <PlaybackBar />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        source={code}
        trace={storeTrace}
        step={index}
      />
    </div>
  );
}
