/// <reference lib="webworker" />
import { runJsTrace } from './jsTracer';
import type { WorkerRequest, WorkerResponse } from '../types/trace';

const RUNTIME_VERSION = 'acorn-8';

function post(msg: WorkerResponse) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
}

// Network-strip the worker global BEFORE any user code can run — same
// containment as the Python worker (PLAN.md §9.1). new Function's shadowed
// params are the second layer; this is the backstop.
(() => {
  const g = self as any;
  try {
    g.fetch = () => Promise.reject(new Error('Network access is disabled in Codelapse.'));
    g.XMLHttpRequest = undefined;
    g.WebSocket = undefined;
    g.EventSource = undefined;
    g.importScripts = () => {
      throw new Error('Network access is disabled in Codelapse.');
    };
  } catch {
    /* best-effort */
  }
})();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, type, source } = e.data;
  if (type !== 'run') return;
  try {
    const body = runJsTrace(source);
    post({ id, type: 'result', json: JSON.stringify(body), runtimeVersion: RUNTIME_VERSION });
  } catch (err: unknown) {
    post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
