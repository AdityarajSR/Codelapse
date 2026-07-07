/**
 * The unified, language-agnostic trace schema.
 *
 * Every tracer (browser: Python via settrace, JS/TS via AST-instrumentation;
 * later server: Go/Java/… via a headless debugger) emits this exact shape, and
 * the whole player — editor highlight, panels, control-flow graph, and the 3D
 * stage — consumes it unchanged. See docs/PLAN.md §4a.
 */

/** A small, closed vocabulary the 3D stage switches on. New languages map their
 * types onto these kinds rather than inventing renderers. */
export type VarKind = 'scalar' | 'string' | 'array' | 'dict' | 'set' | 'object' | 'ref';

export interface VarSnapshot {
  /** Safe, length-capped display representation. */
  repr: string;
  /** The runtime type name (e.g. "int", "list"). */
  type: string;
  kind: VarKind;
  /** Object identity for aliasing/backing-array visuals (future). */
  ref?: string;
}

export interface Frame {
  funcName: string;
  line: number;
}

export type StepEvent = 'line' | 'call' | 'return' | 'exception';

export interface Step {
  stepIndex: number;
  line: number;
  funcName: string;
  event: StepEvent;
  callStack: Frame[];
  locals: Record<string, VarSnapshot>;
  /** Per-step stdout DELTA (chars appended at this step), not the cumulative
   * output — reconstructed cumulatively at read time to avoid O(n²) memory. */
  stdout: string;
}

export type TraceStatus =
  'ok' | 'step-cap' | 'output-cap' | 'compile-error' | 'runtime-error' | 'timeout';

export interface Diagnostic {
  type: string;
  message: string;
  line?: number | null;
  col?: number | null;
}

/** Languages the browser tier can trace today. Server-tier languages
 * (Go, Java, C/C++ — see PLAN.md §6) join this union when that tier ships. */
export type Language = 'python' | 'javascript';

export interface Trace {
  schemaVersion: 1;
  language: Language;
  site: 'browser';
  status: TraceStatus;
  diagnostics: Diagnostic[];
  steps: Step[];
  /** stdout produced after the last recorded step (e.g. just before a crash). */
  finalStdout?: string;
  /** Version stamp so shared links can warn on runtime drift. */
  runtimeVersion: string;
}

/** Messages exchanged with the Pyodide worker. */
export type WorkerRequest = { id: number; type: 'run'; source: string };

export type WorkerResponse =
  | { id: number; type: 'status'; phase: 'loading' | 'ready' }
  /** The trace body as a raw JSON string — a string structured-clones as a
   * cheap memcpy across the worker boundary; the main thread parses once. */
  | { id: number; type: 'result'; json: string; runtimeVersion: string }
  | { id: number; type: 'error'; message: string };
