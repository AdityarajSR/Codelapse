/**
 * Builds the compact run snapshot sent with each AI question — the current
 * step, what just changed, and a little history. Never the whole trace (a run
 * can hold thousands of steps).
 */
import { cumulativeStdout } from '../lib/traceModel';
import type { Language, Trace } from '../types/trace';
import { LIMITS, type AssistantContext, type StepContext, type VarChange } from './protocol';

const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max) + '…');

export function buildAssistantContext(
  code: string,
  language: Language,
  trace: Trace | null,
  index: number,
): AssistantContext {
  // A trace for a different language belongs to old code — don't mix them.
  const usable = trace && trace.language === language ? trace : null;
  const steps = usable?.steps ?? [];
  const i = Math.max(0, Math.min(index, steps.length - 1));
  const cur = steps[i];
  const prev = i > 0 ? steps[i - 1] : undefined;

  let step: StepContext | null = null;
  if (cur) {
    const locals: StepContext['locals'] = {};
    for (const [name, v] of Object.entries(cur.locals).slice(0, LIMITS.locals)) {
      locals[name] = { repr: clip(v.repr, LIMITS.repr), type: v.type };
    }
    const changes: VarChange[] = [];
    const sameFrame =
      prev && prev.callStack.length === cur.callStack.length && prev.funcName === cur.funcName;
    if (sameFrame) {
      for (const [name, v] of Object.entries(cur.locals)) {
        const before = prev.locals[name];
        if (!before || before.repr !== v.repr) {
          changes.push({
            name,
            from: before ? clip(before.repr, LIMITS.repr) : null,
            to: clip(v.repr, LIMITS.repr),
          });
        }
        if (changes.length >= LIMITS.changes) break;
      }
    }
    step = {
      index: i,
      line: cur.line,
      event: cur.event,
      funcName: cur.funcName,
      callStack: cur.callStack.slice(0, LIMITS.stackFrames),
      locals,
      changes,
      previousLine: prev ? prev.line : null,
      outputSoFar: cumulativeStdout(steps, i).slice(-LIMITS.output),
    };
  }

  const recentLines = steps
    .slice(Math.max(0, i - 11), i + 1)
    .map((s) => s.line)
    .slice(-LIMITS.recentLines);

  return {
    language,
    code: code.slice(0, LIMITS.code),
    status: usable?.status ?? null,
    totalSteps: steps.length,
    diagnostics: (usable?.diagnostics ?? []).slice(0, LIMITS.diagnostics).map((d) => ({
      type: d.type,
      message: clip(d.message, 1_000),
      line: d.line ?? null,
    })),
    step,
    recentLines,
  };
}
