/**
 * The wire contract between the AI assistant panel (browser) and the
 * `/api/assistant` route (server). Pure and dependency-free so both sides —
 * and the tests — share one definition and one validator.
 */
import type { Language, StepEvent, TraceStatus } from '../types/trace';

/** What the student asked for. Each mode is a preset prompt on one endpoint. */
export type AssistantMode =
  | 'ask' // free-form question about the code
  | 'explain' // what does this program do, overall
  | 'line-by-line' // beginner walkthrough of every line
  | 'step' // explain the current execution step in depth
  | 'debug' // explain the error / find logical bugs / suggest fixes
  | 'complexity' // time + space complexity, optimisation ideas
  | 'practice' // quiz, hints and practice questions
  | 'generate'; // write a new program from a request (fills the editor)

export const ASSISTANT_MODES: readonly AssistantMode[] = [
  'ask',
  'explain',
  'line-by-line',
  'step',
  'debug',
  'complexity',
  'practice',
  'generate',
];

export interface VarChange {
  name: string;
  /** null when the variable first appeared at this step */
  from: string | null;
  to: string;
}

/** A compact snapshot of where execution is — never the whole trace. */
export interface StepContext {
  /** 0-based step index */
  index: number;
  line: number;
  event: StepEvent;
  funcName: string;
  /** innermost first, like the trace */
  callStack: { funcName: string; line: number }[];
  locals: Record<string, { repr: string; type: string }>;
  /** what changed since the previous step */
  changes: VarChange[];
  /** the line that ran just before this one, if any */
  previousLine: number | null;
  /** tail of everything printed so far */
  outputSoFar: string;
}

export interface AssistantContext {
  language: Language;
  code: string;
  /** null when the code has not been run yet */
  status: TraceStatus | null;
  totalSteps: number;
  diagnostics: { type: string; message: string; line?: number | null }[];
  step: StepContext | null;
  /** the last few executed line numbers, oldest first */
  recentLines: number[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRequest {
  mode: AssistantMode;
  /** the student's own words; optional for preset modes */
  question: string;
  /** earlier turns of this conversation, oldest first */
  history: ChatTurn[];
  context: AssistantContext;
}

/** Marks an error inside an already-started text stream. */
export const STREAM_ERROR_MARK = '\u0000ERR:';
/** "Discard what you've shown so far — a fresh answer follows" (the server
 * retried after the AI failed mid-answer). */
export const STREAM_RESET_MARK = '\u0000RESET\u0000';

/* ------------------------------------------------------------- limits -- */

export const LIMITS = {
  code: 20_000,
  question: 2_000,
  historyTurns: 16,
  turnChars: 8_000,
  locals: 40,
  repr: 300,
  output: 2_000,
  stackFrames: 30,
  changes: 40,
  recentLines: 30,
  diagnostics: 5,
} as const;

/* ---------------------------------------------------------- validation -- */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length <= max ? v : null;
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10_000_000 ? v : null;
const cap = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max) + '…');

const LANGUAGES = new Set(['python', 'javascript']);
const EVENTS = new Set(['line', 'call', 'return', 'exception']);
const STATUSES = new Set([
  'ok',
  'step-cap',
  'output-cap',
  'compile-error',
  'runtime-error',
  'timeout',
]);

function parseFrames(v: unknown): StepContext['callStack'] | null {
  if (!Array.isArray(v)) return null;
  const out: StepContext['callStack'] = [];
  for (const f of v.slice(0, LIMITS.stackFrames)) {
    if (!isObj(f)) return null;
    const funcName = str(f.funcName, 200);
    const line = int(f.line);
    if (funcName === null || line === null) return null;
    out.push({ funcName, line });
  }
  return out;
}

function parseStep(v: unknown): StepContext | null | 'invalid' {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) return 'invalid';
  const index = int(v.index);
  const line = int(v.line);
  const event = typeof v.event === 'string' && EVENTS.has(v.event) ? (v.event as StepEvent) : null;
  const funcName = str(v.funcName, 200);
  const callStack = parseFrames(v.callStack);
  const outputSoFar = typeof v.outputSoFar === 'string' ? v.outputSoFar : null;
  const previousLine = v.previousLine === null ? null : int(v.previousLine);
  if (
    index === null ||
    line === null ||
    event === null ||
    funcName === null ||
    callStack === null ||
    outputSoFar === null ||
    (v.previousLine !== null && previousLine === null)
  ) {
    return 'invalid';
  }

  const locals: StepContext['locals'] = {};
  if (!isObj(v.locals)) return 'invalid';
  for (const [name, snap] of Object.entries(v.locals).slice(0, LIMITS.locals)) {
    if (!isObj(snap) || typeof snap.repr !== 'string' || typeof snap.type !== 'string') {
      return 'invalid';
    }
    locals[cap(name, 100)] = { repr: cap(snap.repr, LIMITS.repr), type: cap(snap.type, 60) };
  }

  if (!Array.isArray(v.changes)) return 'invalid';
  const changes: VarChange[] = [];
  for (const c of v.changes.slice(0, LIMITS.changes)) {
    if (!isObj(c) || typeof c.name !== 'string' || typeof c.to !== 'string') return 'invalid';
    if (c.from !== null && typeof c.from !== 'string') return 'invalid';
    changes.push({
      name: cap(c.name, 100),
      from: c.from === null ? null : cap(c.from, LIMITS.repr),
      to: cap(c.to, LIMITS.repr),
    });
  }

  return {
    index,
    line,
    event,
    funcName,
    callStack,
    locals,
    changes,
    previousLine,
    outputSoFar: outputSoFar.slice(-LIMITS.output),
  };
}

function parseContext(v: unknown): Result<AssistantContext> {
  if (!isObj(v)) return { ok: false, error: 'context must be an object' };
  if (typeof v.language !== 'string' || !LANGUAGES.has(v.language)) {
    return { ok: false, error: 'unsupported language' };
  }
  const code = str(v.code, LIMITS.code);
  if (code === null) return { ok: false, error: `code must be at most ${LIMITS.code} characters` };
  if (v.status !== null && (typeof v.status !== 'string' || !STATUSES.has(v.status))) {
    return { ok: false, error: 'invalid status' };
  }
  const totalSteps = int(v.totalSteps);
  if (totalSteps === null) return { ok: false, error: 'invalid totalSteps' };

  if (!Array.isArray(v.diagnostics)) return { ok: false, error: 'invalid diagnostics' };
  const diagnostics: AssistantContext['diagnostics'] = [];
  for (const d of v.diagnostics.slice(0, LIMITS.diagnostics)) {
    if (!isObj(d) || typeof d.type !== 'string' || typeof d.message !== 'string') {
      return { ok: false, error: 'invalid diagnostic' };
    }
    const line = d.line === null || d.line === undefined ? null : int(d.line);
    diagnostics.push({ type: cap(d.type, 100), message: cap(d.message, 1_000), line });
  }

  const step = parseStep(v.step);
  if (step === 'invalid') return { ok: false, error: 'invalid step' };

  if (!Array.isArray(v.recentLines)) return { ok: false, error: 'invalid recentLines' };
  const recentLines: number[] = [];
  for (const n of v.recentLines.slice(-LIMITS.recentLines)) {
    const line = int(n);
    if (line === null) return { ok: false, error: 'invalid recentLines' };
    recentLines.push(line);
  }

  return {
    ok: true,
    value: {
      language: v.language as Language,
      code,
      status: v.status as TraceStatus | null,
      totalSteps,
      diagnostics,
      step,
      recentLines,
    },
  };
}

/** Validate an untrusted request body. Oversized fields are rejected (code,
 * question) or trimmed (reprs, output) — never silently passed through. */
export function parseAssistantRequest(body: unknown): Result<AssistantRequest> {
  if (!isObj(body)) return { ok: false, error: 'body must be a JSON object' };

  const mode = body.mode;
  if (typeof mode !== 'string' || !ASSISTANT_MODES.includes(mode as AssistantMode)) {
    return { ok: false, error: 'unknown mode' };
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length > LIMITS.question) {
    return { ok: false, error: `question must be at most ${LIMITS.question} characters` };
  }
  if ((mode === 'ask' || mode === 'generate') && question.length === 0) {
    return { ok: false, error: 'question is required' };
  }

  if (!Array.isArray(body.history)) return { ok: false, error: 'history must be an array' };
  if (body.history.length > LIMITS.historyTurns * 2) {
    return { ok: false, error: 'conversation is too long — clear the chat to start fresh' };
  }
  const history: ChatTurn[] = [];
  for (const t of body.history.slice(-LIMITS.historyTurns)) {
    if (
      !isObj(t) ||
      (t.role !== 'user' && t.role !== 'assistant') ||
      typeof t.content !== 'string'
    ) {
      return { ok: false, error: 'invalid history turn' };
    }
    if (t.content.trim().length === 0) continue;
    history.push({ role: t.role, content: cap(t.content, LIMITS.turnChars) });
  }
  // The API needs the conversation to start with a user turn.
  while (history.length > 0 && history[0].role !== 'user') history.shift();

  const context = parseContext(body.context);
  if (!context.ok) return context;

  return {
    ok: true,
    value: { mode: mode as AssistantMode, question, history, context: context.value },
  };
}
