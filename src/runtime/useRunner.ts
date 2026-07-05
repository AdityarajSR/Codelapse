import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trace, WorkerRequest, WorkerResponse } from '../types/trace';

export type RunPhase = 'idle' | 'booting' | 'running' | 'done' | 'error';

/**
 * Owns the Pyodide Web Worker and the run lifecycle. Only the latest run's
 * result is applied (stale results from superseded runs are dropped).
 */
export function useRunner() {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../worker/pyodide.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== idRef.current) return; // stale run
      if (msg.type === 'status') {
        setPhase(msg.phase === 'loading' ? 'booting' : 'running');
      } else if (msg.type === 'result') {
        const trace: Trace = {
          schemaVersion: 1,
          language: 'python',
          site: 'browser',
          runtimeVersion: msg.runtimeVersion,
          ...JSON.parse(msg.json),
        };
        setTrace(trace);
        setError(null);
        setPhase('done');
      } else if (msg.type === 'error') {
        setError(msg.message);
        setPhase('error');
      }
    };

    return () => worker.terminate();
  }, []);

  const run = useCallback((source: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = ++idRef.current;
    setPhase('running');
    setError(null);
    const req: WorkerRequest = { id, type: 'run', source };
    worker.postMessage(req);
  }, []);

  return { phase, trace, error, run };
}
