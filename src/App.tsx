import { useEffect, useMemo, useRef, useState } from 'react';
import { CallStackPanel } from './components/CallStackPanel';
import { CodeEditor } from './components/CodeEditor';
import { Header } from './components/Header';
import { OutputPanel } from './components/OutputPanel';
import { PlaybackBar } from './components/PlaybackBar';
import { StagePreview } from './components/StagePreview';
import { StatusBanner } from './components/StatusBanner';
import { VariablesPanel } from './components/VariablesPanel';
import { defaultExample, examples } from './examples';
import { changedVars, cumulativeStdout } from './lib/traceModel';
import { useRunner } from './runtime/useRunner';
import { usePlayback } from './state/playbackStore';

export default function App() {
  const [code, setCode] = useState(defaultExample.code);
  const [exampleId, setExampleId] = useState(defaultExample.id);
  const { phase, trace, error, run } = useRunner();

  const setTrace = usePlayback((s) => s.setTrace);
  const play = usePlayback((s) => s.play);
  const storeTrace = usePlayback((s) => s.trace);
  const index = usePlayback((s) => s.index);

  // Push each new trace into the single playback clock.
  useEffect(() => {
    if (trace) setTrace(trace);
  }, [trace, setTrace]);

  // Auto-run the built-in default example once for an alive first impression.
  // Only the built-in example is ever auto-run — never shared code (§9.1/§9.6).
  useEffect(() => {
    run(defaultExample.code);
  }, [run]);

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

  const onRun = () => run(code);
  const onPickExample = (id: string) => {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    setExampleId(id);
    setCode(ex.code);
    setTrace(null);
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
          <StatusBanner trace={storeTrace} workerError={error} />
          <StagePreview locals={current?.locals ?? {}} />
          <div className="panels">
            <VariablesPanel locals={current?.locals ?? {}} changed={changed} stepKey={index} />
            <OutputPanel text={stdout} />
            <CallStackPanel frames={current?.callStack ?? []} />
          </div>
        </div>
      </main>

      <PlaybackBar />
    </div>
  );
}
