import { describe, expect, it } from 'vitest';
import { runJsTrace } from '../worker/jsTracer';
import type { Language, Step, Trace } from '../types/trace';
import { buildAssistantContext } from './context';
import { adviceFor, describeLine, narrateStep } from './narrate';
import { parseAssistantRequest, type AssistantRequest } from './protocol';
import { buildPrompt, renderContext } from './prompt';
import { buildQuiz } from './quiz';

function jsTrace(source: string): Trace {
  return {
    schemaVersion: 1,
    language: 'javascript',
    site: 'browser',
    runtimeVersion: 'test',
    ...runJsTrace(source),
  };
}

function step(partial: Partial<Step> & { stepIndex: number; line: number }): Step {
  return {
    funcName: '<module>',
    event: 'line',
    callStack: [{ funcName: '<module>', line: partial.line }],
    locals: {},
    stdout: '',
    ...partial,
  };
}

function pyTrace(steps: Step[], extra: Partial<Trace> = {}): Trace {
  return {
    schemaVersion: 1,
    language: 'python',
    site: 'browser',
    runtimeVersion: 'test',
    status: 'ok',
    diagnostics: [],
    steps,
    ...extra,
  };
}

const LOOP_JS = `let total = 0;\nfor (let i = 1; i <= 3; i++) {\n  total += i;\n}\nconsole.log(total);`;

/* ---------------------------------------------------------- describeLine -- */

describe('describeLine', () => {
  const cases: [string, Language, RegExp][] = [
    ['for i in range(3):', 'python', /for.*loop header.*range\(3\).*i/],
    ['while n > 0:', 'python', /while.*n > 0/],
    ['if x % 2 == 0:', 'python', /condition.*x % 2 == 0/],
    ['def add(a, b):', 'python', /defines the function.*add\(\).*parameters/],
    ['return a + b', 'python', /returns.*a \+ b/],
    ['nums.append(4)', 'python', /end of the list.*nums/],
    ['total += i', 'python', /adds.*i.*to.*total/],
    ['a, b = b, a', 'python', /several variables/],
    ['print(total)', 'python', /prints/],
    ['const sum = a + b;', 'javascript', /creates the variable.*sum/],
    ['for (let i = 0; i < 3; i++) {', 'javascript', /starts with.*let i = 0.*i < 3.*i\+\+/],
    ['for (const x of xs) {', 'javascript', /for…of.*xs.*x/],
    ['arr.push(1);', 'javascript', /end of the array.*arr/],
    ['console.log(x);', 'javascript', /prints/],
  ];
  it.each(cases)('%s (%s)', (text, lang, expected) => {
    expect(describeLine(text, lang)).toMatch(expected);
  });
});

/* ----------------------------------------------------------- narrateStep -- */

describe('narrateStep', () => {
  it('asks the student to run when there is no trace', () => {
    expect(narrateStep(null, 0, '').headline).toMatch(/Press Run/);
  });

  it('explains variable changes, loop jumps and output on a real JS run', () => {
    const trace = jsTrace(LOOP_JS);
    const all = trace.steps.map((_, i) => narrateStep(trace, i, LOOP_JS));
    const texts = all.flatMap((n) => n.points.map((p) => `${p.kind}: ${p.text}`));

    expect(all[0].headline).toMatch(/program starts/);
    expect(texts.some((t) => /^change: `total` changed from `0` to `1`/.test(t))).toBe(true);
    expect(texts.some((t) => /^change: `total` changed from `3` to `6`/.test(t))).toBe(true);
    expect(texts.some((t) => t.startsWith('done:'))).toBe(true);
  });

  it('explains a function call and the return to the caller', () => {
    const src = `function add(a, b) {\n  const sum = a + b;\n  return sum;\n}\nconst r = add(2, 3);\nconsole.log(r);`;
    const trace = jsTrace(src);
    const callIdx = trace.steps.findIndex((s) => s.funcName === 'add');
    const call = narrateStep(trace, callIdx, src);
    expect(call.headline).toMatch(/`add\(\)` was just called/);
    const stack = call.points.find((p) => p.kind === 'stack');
    expect(stack?.text).toMatch(/a = 2, b = 3/);
    expect(stack?.text).toMatch(/2 deep/);

    const backIdx = trace.steps.findIndex((s, i) => i > callIdx && s.funcName === '<module>');
    const back = narrateStep(trace, backIdx, src);
    expect(back.headline).toMatch(/Back in the main program/);
  });

  it('reports a true / false condition from where execution went next', () => {
    const src = 'x = 5\nif x > 10:\n    print("big")\nprint("done")';
    const mk = (i: number, line: number) =>
      step({ stepIndex: i, line, locals: { x: { repr: '5', type: 'int', kind: 'scalar' } } });
    const trace = pyTrace([mk(0, 1), mk(1, 2), mk(2, 4)]);
    const n = narrateStep(trace, 2, src);
    expect(n.points.find((p) => p.kind === 'flow')?.text).toMatch(/line 2 was \*\*false\*\*/);
  });

  it('counts loop rounds when jumping back to a loop header', () => {
    const src = 'for i in range(3):\n    print(i)';
    const steps: Step[] = [];
    const lines = [1, 2, 1, 2, 1];
    lines.forEach((line, k) =>
      steps.push(
        step({
          stepIndex: k,
          line,
          locals:
            k === 0
              ? {}
              : { i: { repr: String(Math.floor((k - 1) / 2)), type: 'int', kind: 'scalar' } },
        }),
      ),
    );
    const trace = pyTrace(steps);
    const flow = narrateStep(trace, 4, src).points.find((p) => p.kind === 'flow');
    expect(flow?.text).toMatch(
      /jumped back up from line 2 to the loop header on line 1 \(loop check #3\)/,
    );
  });

  it('explains a runtime error on the last step with a fix', () => {
    const src = 'nums = [1, 2]\nprint(nums[5])';
    const trace = pyTrace([step({ stepIndex: 0, line: 1 }), step({ stepIndex: 1, line: 2 })], {
      status: 'runtime-error',
      diagnostics: [{ type: 'IndexError', message: 'list index out of range', line: 2 }],
    });
    const err = narrateStep(trace, 1, src).points.find((p) => p.kind === 'error');
    expect(err?.text).toMatch(/IndexError.*line 2.*position.*Fix:/);
  });

  it('explains a compile error with no steps', () => {
    const trace = pyTrace([], {
      status: 'compile-error',
      diagnostics: [{ type: 'SyntaxError', message: 'invalid syntax', line: 3 }],
    });
    const n = narrateStep(trace, 0, 'x = (');
    expect(n.headline).toMatch(/could not start/);
    expect(n.points[0].kind).toBe('error');
  });

  it('has advice for unknown error types', () => {
    expect(adviceFor('WeirdError').fix).toMatch(/Find bugs/);
  });
});

/* ------------------------------------------------------------------ quiz -- */

describe('buildQuiz', () => {
  it('builds a value question whose answer matches the trace', () => {
    const trace = jsTrace(LOOP_JS);
    const q = buildQuiz(trace, 0, LOOP_JS, 0);
    expect(q).not.toBeNull();
    expect(q!.kind).toBe('value');
    expect(q!.options).toContain(q!.answer);
    expect(new Set(q!.options).size).toBe(q!.options.length);
    expect(q!.options.length).toBeGreaterThanOrEqual(3);
    // The answer is the real value at the reveal step.
    const revealed = Object.values(trace.steps[q!.revealStep].locals).map((v) => v.repr);
    expect(revealed).toContain(q!.answer);
    expect(q!.askStep).toBe(q!.revealStep - 1);
  });

  it('builds a next-line question for a jump', () => {
    const trace = jsTrace(LOOP_JS);
    const q = buildQuiz(trace, 0, LOOP_JS, 1);
    expect(q).not.toBeNull();
    if (q!.kind === 'next-line') {
      const next = trace.steps[q!.revealStep].line;
      expect(q!.answer.startsWith(`Line ${next}:`)).toBe(true);
    }
  });

  it('is deterministic for the same step', () => {
    const trace = jsTrace(LOOP_JS);
    expect(buildQuiz(trace, 1, LOOP_JS)).toEqual(buildQuiz(trace, 1, LOOP_JS));
  });

  it('returns null without a usable trace', () => {
    expect(buildQuiz(null, 0, '')).toBeNull();
  });
});

/* ----------------------------------------------------- context + prompt -- */

function sampleRequest(): AssistantRequest {
  const trace = jsTrace(LOOP_JS);
  return {
    mode: 'step',
    question: '',
    history: [],
    context: buildAssistantContext(LOOP_JS, 'javascript', trace, 4),
  };
}

describe('buildAssistantContext', () => {
  it('captures the current step and what changed', () => {
    const ctx = sampleRequest().context;
    expect(ctx.status).toBe('ok');
    expect(ctx.step?.index).toBe(4);
    expect(ctx.step?.locals.total).toBeDefined();
    expect(ctx.recentLines.length).toBeGreaterThan(0);
  });

  it('ignores a trace from another language', () => {
    const trace = jsTrace(LOOP_JS);
    const ctx = buildAssistantContext('print(1)', 'python', trace, 2);
    expect(ctx.step).toBeNull();
    expect(ctx.status).toBeNull();
  });
});

describe('parseAssistantRequest', () => {
  it('accepts a request built by the client (round-trip through JSON)', () => {
    const parsed = parseAssistantRequest(JSON.parse(JSON.stringify(sampleRequest())));
    expect(parsed.ok).toBe(true);
  });

  it('rejects unknown modes, empty free questions and oversized code', () => {
    const base = sampleRequest();
    expect(parseAssistantRequest({ ...base, mode: 'hack' }).ok).toBe(false);
    expect(parseAssistantRequest({ ...base, mode: 'ask', question: '   ' }).ok).toBe(false);
    expect(
      parseAssistantRequest({ ...base, context: { ...base.context, code: 'x'.repeat(30_000) } }).ok,
    ).toBe(false);
    expect(parseAssistantRequest(null).ok).toBe(false);
  });

  it('drops a leading assistant turn so the conversation starts with the user', () => {
    const base = sampleRequest();
    const parsed = parseAssistantRequest({
      ...base,
      history: [
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ],
    });
    expect(parsed.ok && parsed.value.history[0].role).toBe('user');
  });
});

describe('buildPrompt', () => {
  it('puts numbered code and the step snapshot in the newest user turn', () => {
    const { system, messages } = buildPrompt(sampleRequest());
    expect(system).toMatch(/tutor inside Codelapse/);
    const last = messages[messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toMatch(/<program language="javascript">/);
    expect(last.content).toMatch(/1 \| let total = 0;/);
    expect(last.content).toMatch(/<current_step number="5"/);
    expect(last.content).toMatch(/Explain the current step/);
  });

  it('describes an un-run program', () => {
    const ctx = buildAssistantContext('print(1)', 'python', null, 0);
    expect(renderContext(ctx)).toMatch(/has not been run yet/);
  });
});
