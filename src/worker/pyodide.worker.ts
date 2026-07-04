/// <reference lib="webworker" />
import tracerSrc from './tracer.py?raw';
import type { Trace, WorkerRequest, WorkerResponse } from '../types/trace';

// Pinned Pyodide build. Pinning the exact version keeps shared-link traces
// reproducible (docs/PLAN.md §9.2). Self-hosting these assets is a follow-up;
// for now we load from the pinned jsDelivr path.
const PYODIDE_VERSION = '0.26.4';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const RUNTIME_VERSION = `pyodide-${PYODIDE_VERSION}`;

let pyodidePromise: Promise<any> | null = null;

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

async function getPyodide(id: number): Promise<any> {
  if (!pyodidePromise) {
    post({ id, type: 'status', phase: 'loading' });
    pyodidePromise = (async () => {
      const mod = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
      const py = await mod.loadPyodide({ indexURL: PYODIDE_URL });
      py.runPython(tracerSrc);
      hardenNetwork();
      return py;
    })();
  }
  const py = await pyodidePromise;
  return py;
}

async function run(id: number, source: string) {
  const py = await getPyodide(id);
  post({ id, type: 'status', phase: 'ready' });

  py.globals.set('_codelapse_src', source);
  // run_trace returns a plain dict; serialize on the Python side to avoid
  // proxy lifetime issues crossing the boundary.
  const json: string = py.runPython('import json as _json; _json.dumps(run_trace(_codelapse_src))');
  const partial = JSON.parse(json) as Omit<
    Trace,
    'schemaVersion' | 'language' | 'site' | 'runtimeVersion'
  >;

  const trace: Trace = {
    schemaVersion: 1,
    language: 'python',
    site: 'browser',
    runtimeVersion: RUNTIME_VERSION,
    ...partial,
  };
  post({ id, type: 'result', trace });
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, type, source } = e.data;
  if (type === 'run') {
    run(id, source).catch((err: unknown) => {
      post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
    });
  }
};
