import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language, Trace, WorkerRequest, WorkerResponse } from '../types/trace';

export type RunPhase = 'idle' | 'booting' | 'running' | 'done' | 'error';

/**
 * Owns the tracer Web Workers and the run lifecycle. Python's worker is
 * created eagerly (it warm-starts the Pyodide download); the JS worker is
 * spun up on first use. Only the latest run's result is applied.
 */
export function useRunner() {
  const pyRef = useRef<Worker | null>(null);
  const jsRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const langRef = useRef<Language>('python');
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attach = useCallback((worker: Worker) => {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== idRef.current) return; // stale run
      if (msg.type === 'status') {
        setPhase(msg.phase === 'loading' ? 'booting' : 'running');
      } else if (msg.type === 'result') {
        const next: Trace = {
          schemaVersion: 1,
          language: langRef.current,
          site: 'browser',
          runtimeVersion: msg.runtimeVersion,
          ...JSON.parse(msg.json),
        };
        setTrace(next);
        setError(null);
        setPhase('done');
      } else if (msg.type === 'error') {
        setError(msg.message);
        setPhase('error');
      }
    };
  }, []);

  useEffect(() => {
    const py = new Worker(new URL('../worker/pyodide.worker.ts', import.meta.url), {
      type: 'module',
    });
    pyRef.current = py;
    attach(py);
    return () => {
      py.terminate();
      jsRef.current?.terminate();
      jsRef.current = null;
    };
  }, [attach]);

  const run = useCallback(
    (source: string, language: Language = 'python') => {
      let worker: Worker | null;
      if (language === 'javascript') {
        if (!jsRef.current) {
          jsRef.current = new Worker(new URL('../worker/js.worker.ts', import.meta.url), {
            type: 'module',
          });
          attach(jsRef.current);
        }
        worker = jsRef.current;
      } else {
        worker = pyRef.current;
      }
      if (!worker) return;
      const id = ++idRef.current;
      langRef.current = language;
      setPhase('running');
      setError(null);
      const req: WorkerRequest = { id, type: 'run', source };
      worker.postMessage(req);
    },
    [attach],
  );

  return { phase, trace, error, run };
}
