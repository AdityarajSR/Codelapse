import { describe, expect, it } from 'vitest';
import { runJsTrace } from './jsTracer';

describe('runJsTrace', () => {
  it('traces variables and output through a loop', () => {
    const body = runJsTrace(
      `let nums = [];\nfor (let i = 0; i < 3; i++) {\n  nums.push(i * 2);\n  console.log(i);\n}`,
    );
    expect(body.status).toBe('ok');
    expect(body.steps.length).toBeGreaterThan(5);
    const last = body.steps[body.steps.length - 1];
    expect(last.locals.nums.repr).toBe('[0, 2, 4]');
    expect(last.locals.nums.kind).toBe('array');
    const stdout = body.steps.map((s) => s.stdout).join('') + (body.finalStdout ?? '');
    expect(stdout).toBe('0\n1\n2\n');
  });

  it('tracks the call stack through function calls', () => {
    const body = runJsTrace(
      `function add(a, b) {\n  const sum = a + b;\n  return sum;\n}\nconst r = add(2, 3);\nconsole.log(r);`,
    );
    expect(body.status).toBe('ok');
    const inside = body.steps.find((s) => s.funcName === 'add');
    expect(inside).toBeDefined();
    expect(inside!.callStack.length).toBe(2);
    expect(inside!.callStack[1].funcName).toBe('<module>');
    expect(inside!.locals.a.repr).toBe('2');
    // stack unwinds after return
    const last = body.steps[body.steps.length - 1];
    expect(last.callStack.length).toBe(1);
    expect(last.locals.r.repr).toBe('5');
  });

  it('reports runtime errors with the last executed line and keeps the partial trace', () => {
    const body = runJsTrace(`const a = 1;\nconst b = null;\nb.x;`);
    expect(body.status).toBe('runtime-error');
    expect(body.diagnostics[0].type).toBe('TypeError');
    expect(body.diagnostics[0].line).toBe(3);
    expect(body.steps.length).toBeGreaterThan(0);
  });

  it('reports syntax errors as compile-error with a line', () => {
    const body = runJsTrace(`let x = ;`);
    expect(body.status).toBe('compile-error');
    expect(body.diagnostics[0].line).toBe(1);
    expect(body.steps).toHaveLength(0);
  });

  it('step-caps an infinite loop — even with an empty body', () => {
    const body = runJsTrace(`while (true) {}`);
    expect(body.status).toBe('step-cap');
    expect(body.steps.length).toBeGreaterThan(0);
  });

  it('step-caps a single-statement (no-block) infinite loop', () => {
    const body = runJsTrace(`let i = 0;\nwhile (true) i++;`);
    expect(body.status).toBe('step-cap');
  });

  it('skips let/const before initialization (TDZ) instead of crashing', () => {
    const body = runJsTrace(`console.log('hi');\nlet z = 2;\nconsole.log(z);`);
    expect(body.status).toBe('ok');
    expect(body.steps[0].locals.z).toBeUndefined();
    const last = body.steps[body.steps.length - 1];
    expect(last.locals.z.repr).toBe('2');
  });

  it('maps plain objects to dict so the stage can render them', () => {
    const body = runJsTrace(`const seen = { a: 1, b: 2 };\nconsole.log(seen);`);
    expect(body.status).toBe('ok');
    const last = body.steps[body.steps.length - 1];
    expect(last.locals.seen.kind).toBe('dict');
    expect(last.locals.seen.repr).toBe('{a: 1, b: 2}');
  });

  it('closures see outer variables', () => {
    const body = runJsTrace(
      `function outer() {\n  let count = 0;\n  function inc() {\n    count += 1;\n    return count;\n  }\n  inc();\n  return count;\n}\nconst result = outer();`,
    );
    expect(body.status).toBe('ok');
    const inInc = body.steps.find((s) => s.funcName === 'inc');
    expect(inInc).toBeDefined();
    expect(inInc!.locals.count).toBeDefined();
    const last = body.steps[body.steps.length - 1];
    expect(last.locals.result.repr).toBe('1');
  });

  it('user code cannot reach the network', () => {
    const body = runJsTrace(`let blocked = typeof fetch;\nlet ws = typeof WebSocket;`);
    expect(body.status).toBe('ok');
    const last = body.steps[body.steps.length - 1];
    expect(last.locals.blocked.repr).toBe('"undefined"');
    expect(last.locals.ws.repr).toBe('"undefined"');
  });
});
