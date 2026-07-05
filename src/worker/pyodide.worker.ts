/// <reference lib="webworker" />
import tracerSrc from './tracer.py?raw';
import type { WorkerRequest, WorkerResponse } from '../types/trace';

// Pinned Pyodide build. Pinning the exact version keeps shared-link traces
// reproducible (docs/PLAN.md §9.2). Self-hosting these assets is a follow-up;
// for now we load from the pinned jsDelivr path.
const PYODIDE_VERSION = '0.26.4';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const RUNTIME_VERSION = `pyodide-${PYODIDE_VERSION}`;

function post(msg: WorkerResponse) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
}

/**
 * Remove network primitives from the worker global AFTER Pyodide has finished
 * loading, so untrusted user code (browser-tier) cannot reach the network — no
 * fetch/XHR/WebSocket exfiltration, SSRF, or crypto-mining callbacks. WASM
 * sandboxes CPU/memory but not the network, so this is the real containment
 * for the shared-link "runs in the viewer's browser" threat (PLAN.md §9.1).
 */
function hardenNetwork() {
  const g = self as any;
  const deny = () => {
    throw new Error('Network access is disabled in Codelapse.');
  };
  try {
    g.fetch = () => Promise.reject(new Error('Network access is disabled in Codelapse.'));
    g.XMLHttpRequest = undefined;
    g.WebSocket = undefined;
    g.importScripts = deny;
    g.EventSource = undefined;
  } catch {
    /* best-effort */
  }
}

// Warm start: begin fetching the ~7MB runtime the moment the worker spawns, so
// the download overlaps React boot and first paint instead of serializing
// behind the first run request.
const pyodidePromise: Promise<any> = (async () => {
  const mod = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
  const py = await mod.loadPyodide({ indexURL: PYODIDE_URL });
  py.runPython(tracerSrc);
  hardenNetwork();
  return py;
})();

let ready = false;

async function run(id: number, source: string) {
  if (!ready) post({ id, type: 'status', phase: 'loading' });
  const py = await pyodidePromise;
  ready = true;
  post({ id, type: 'status', phase: 'ready' });

  py.globals.set('_codelapse_src', source);
  // run_trace returns a plain dict; serialize on the Python side and ship the
  // string — the main thread does the single JSON.parse.
  const json: string = py.runPython('import json as _json; _json.dumps(run_trace(_codelapse_src))');
  post({ id, type: 'result', json, runtimeVersion: RUNTIME_VERSION });
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, type, source } = e.data;
  if (type === 'run') {
    run(id, source).catch((err: unknown) => {
      post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
    });
  }
};
