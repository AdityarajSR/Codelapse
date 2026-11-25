/**
 * Prediction quizzes generated from the recorded run — no AI involved, so the
 * correct answer is always what really happened.
 *
 * Two kinds:
 *  - "value": after line N runs, what will `x` be?
 *  - "next-line": which line runs right after line N?
 */
import type { Step, Trace, VarSnapshot } from '../types/trace';
import { lineText } from './narrate';

export interface QuizQuestion {
  kind: 'value' | 'next-line';
  prompt: string;
  /** the line the question is about, for the code excerpt */
  line: number;
  lineCode: string;
  options: string[];
  answer: string;
  /** step index where the answer becomes visible ("Show me") */
  revealStep: number;
  /** step index the student should be at while answering */
  askStep: number;
  explanation: string;
}

const HIDDEN_TYPES = new Set(['function', 'builtin_function_or_method', 'module', 'type', 'class']);
const isData = (v: VarSnapshot) => !HIDDEN_TYPES.has(v.type) && !v.repr.startsWith('<function');
const MAX_OPTION = 40;

/** Small deterministic PRNG so the same step always yields the same quiz. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sameFrame = (a: Step, b: Step) =>
  a.callStack.length === b.callStack.length && a.funcName === b.funcName;

/** Plausible wrong answers for a value question. */
function valueDistractors(
  correct: string,
  before: string | undefined,
  history: string[],
  rand: () => number,
): string[] {
  const pool = new Set<string>();
  if (before !== undefined && before !== correct) pool.add(before);
  const n = Number(correct);
  if (correct.trim() !== '' && Number.isFinite(n)) {
    const isInt = Number.isInteger(n);
    const candidates = isInt
      ? [n + 1, n - 1, n * 2, before !== undefined ? Number(before) + 1 : n + 2]
      : [n + 1, n - 1, n * 2];
    for (const c of candidates) {
      if (Number.isFinite(c)) pool.add(String(isInt ? Math.trunc(c) : c));
    }
  } else if (correct === 'True' || correct === 'False') {
    pool.add(correct === 'True' ? 'False' : 'True');
  } else if (correct === 'true' || correct === 'false') {
    pool.add(correct === 'true' ? 'false' : 'true');
  }
  for (const h of shuffle(history, rand)) pool.add(h);
  pool.delete(correct);
  return [...pool].filter((p) => p.length <= MAX_OPTION);
}

function valueQuestion(trace: Trace, from: number, source: string): QuizQuestion | null {
  const steps = trace.steps;
  // Look a little ahead for a line (in the same frame) that changes a variable.
  for (let j = from + 1; j < Math.min(steps.length, from + 60); j++) {
    const before = steps[j - 1];
    const after = steps[j];
    if (!sameFrame(before, after) || before.event === 'return') continue;
    for (const [name, snap] of Object.entries(after.locals)) {
      if (!isData(snap) || snap.repr.length > MAX_OPTION) continue;
      const old = before.locals[name];
      if (old && old.repr === snap.repr) continue;

      const history: string[] = [];
      for (const s of steps) {
        const v = s.locals[name];
        if (v && v.repr !== snap.repr && !history.includes(v.repr)) history.push(v.repr);
        if (history.length > 8) break;
      }
      const rand = rng(j * 7919 + name.length);
      const wrong = valueDistractors(snap.repr, old?.repr, history, rand).slice(0, 3);
      if (wrong.length < 2) continue;

      const code = lineText(source, before.line);
      const options = shuffle([snap.repr, ...wrong], rand);
      return {
        kind: 'value',
        prompt: old
          ? `\`${name}\` is \`${old.repr}\` right now. After line ${before.line} runs, what will \`${name}\` be?`
          : `Line ${before.line} creates \`${name}\`. What value will it have?`,
        line: before.line,
        lineCode: code,
        options,
        answer: snap.repr,
        revealStep: j,
        askStep: j - 1,
        explanation: old
          ? `Line ${before.line} changed \`${name}\` from \`${old.repr}\` to \`${snap.repr}\`.`
          : `Line ${before.line} set \`${name}\` to \`${snap.repr}\`.`,
      };
    }
  }
  return null;
}

function nextLineQuestion(trace: Trace, from: number, source: string): QuizQuestion | null {
  const steps = trace.steps;
  for (let j = from + 1; j < Math.min(steps.length, from + 30); j++) {
    const before = steps[j - 1];
    const after = steps[j];
    if (!sameFrame(before, after) || after.event !== 'line' || before.event !== 'line') continue;
    // only interesting when execution does NOT simply fall to the next line
    if (after.line === before.line + 1) continue;

    const rand = rng(j * 104729 + before.line);
    const candidates = new Set<number>([before.line + 1, before.line - 1]);
    for (const s of steps.slice(Math.max(0, j - 15), j + 15)) candidates.add(s.line);
    candidates.delete(after.line);
    const wrong = shuffle(
      [...candidates].filter((n) => n > 0 && lineText(source, n) !== ''),
      rand,
    ).slice(0, 3);
    if (wrong.length < 2) continue;

    const fmt = (n: number) => `Line ${n}: ${lineText(source, n)}`.slice(0, 60);
    return {
      kind: 'next-line',
      prompt: `Execution is on line ${before.line}. Which line runs next?`,
      line: before.line,
      lineCode: lineText(source, before.line),
      options: shuffle([after.line, ...wrong], rand).map(fmt),
      answer: fmt(after.line),
      revealStep: j,
      askStep: j - 1,
      explanation:
        after.line < before.line
          ? `It jumps back to line ${after.line} — that is how loops repeat.`
          : `It jumps ahead to line ${after.line}, skipping the lines in between (a condition was false or a loop ended).`,
    };
  }
  return null;
}

/** A quiz question about what happens shortly after step `index`, or null
 * when the rest of the run has nothing to ask about. `variant` alternates
 * between question kinds. */
export function buildQuiz(
  trace: Trace | null,
  index: number,
  source: string,
  variant = 0,
): QuizQuestion | null {
  if (!trace || trace.steps.length < 2) return null;
  const from = Math.max(0, Math.min(index, trace.steps.length - 2));
  const order =
    variant % 2 === 0 ? [valueQuestion, nextLineQuestion] : [nextLineQuestion, valueQuestion];
  for (const make of order) {
    const q = make(trace, from, source);
    if (q) return q;
  }
  return null;
}
