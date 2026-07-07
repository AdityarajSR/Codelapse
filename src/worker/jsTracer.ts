/**
 * JavaScript tracer — the browser-tier JS equivalent of tracer.py.
 *
 * Strategy (PLAN.md §6 Phase 1): parse with acorn, inject a `__cl_step(line,
 * {vars})` probe before every statement (plus one at the top of every loop
 * body, so `while(true){}` still hits the step cap), wrap function bodies with
 * enter/exit calls for the call stack, then execute the instrumented source
 * with `new Function` against a sealed console/scope. Emits the same unified
 * trace body as the Python tracer — the player consumes it unchanged.
 *
 * Pure module (no worker APIs) so the whole thing unit-tests in Node.
 */
import * as acorn from 'acorn';
import { fullAncestor } from 'acorn-walk';
import type { Diagnostic, Step, TraceStatus, VarKind } from '../types/trace';

const MAX_STEPS = 4000;
const MAX_REPR = 140;
const MAX_ITEMS = 60;
const MAX_OUTPUT = 200_000;

export interface JsTraceBody {
  status: TraceStatus;
  diagnostics: Diagnostic[];
  steps: Step[];
  finalStdout?: string;
}

/* ------------------------------------------------------------ repr / kinds */

function kindOf(v: unknown): VarKind {
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Map) return 'dict';
  if (v instanceof Set) return 'set';
  if (typeof v === 'function') return 'object';
  if (v !== null && typeof v === 'object') return 'dict';
  return 'scalar';
}

function reprOf(v: unknown, depth = 0): string {
  try {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') {
      const s = v.length <= MAX_REPR ? v : v.slice(0, MAX_REPR) + '…';
      return JSON.stringify(s);
    }
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
      return String(v);
    }
    if (typeof v === 'function') {
      return `ƒ ${(v as { name?: string }).name || 'anonymous'}()`;
    }
    if (depth >= 3) return '…';
    if (Array.isArray(v)) {
      const items = v.slice(0, MAX_ITEMS).map((x) => reprOf(x, depth + 1));
      const more = v.length > MAX_ITEMS ? `, …(+${v.length - MAX_ITEMS})` : '';
      return `[${items.join(', ')}${more}]`;
    }
    if (v instanceof Map) {
      const pairs = [...v.entries()]
        .slice(0, MAX_ITEMS)
        .map(([k, val]) => `${reprOf(k, depth + 1)}: ${reprOf(val, depth + 1)}`);
      return `{${pairs.join(', ')}}`;
    }
    if (v instanceof Set) {
      const items = [...v.values()].slice(0, MAX_ITEMS).map((x) => reprOf(x, depth + 1));
      return `{${items.join(', ')}}`;
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v as object).slice(0, MAX_ITEMS);
      const pairs = keys.map(
        (k) => `${k}: ${reprOf((v as Record<string, unknown>)[k], depth + 1)}`,
      );
      const total = Object.keys(v as object).length;
      const more = total > MAX_ITEMS ? `, …(+${total - MAX_ITEMS})` : '';
      return `{${pairs.join(', ')}${more}}`;
    }
    const r = String(v);
    return r.length <= MAX_REPR ? r : r.slice(0, MAX_REPR) + '…';
  } catch {
    return '<unreprable>';
  }
}

/* --------------------------------------------------------- instrumentation */

type Node = acorn.Node & {
  type: string;
  body?: unknown;
  id?: { name?: string } | null;
  params?: unknown[];
  loc?: acorn.SourceLocation | null;
};

interface Insertion {
  pos: number;
  text: string;
  /** ties at the same position apply in ascending seq order */
  seq: number;
}

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const LOOP_TYPES = new Set([
  'ForStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ForOfStatement',
  'ForInStatement',
]);
/** Runtime helper names — never captured as user variables. */
const RESERVED = new Set(['__cl_step', '__cl_enter', '__cl_exit', '__cl_g', 'console']);

function isNode(x: unknown): x is Node {
  return typeof x === 'object' && x !== null && typeof (x as Node).type === 'string';
}

function childNodes(node: Node): Node[] {
  const out: Node[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const v = (node as unknown as Record<string, unknown>)[key];
    if (isNode(v)) out.push(v);
    else if (Array.isArray(v)) for (const item of v) if (isNode(item)) out.push(item);
  }
  return out;
}

function patternNames(node: Node, out: string[]) {
  switch (node.type) {
    case 'Identifier':
      out.push((node as unknown as { name: string }).name);
      break;
    case 'ObjectPattern':
      for (const p of (node as unknown as { properties: Node[] }).properties) {
        const prop = p as unknown as { type: string; value?: Node; argument?: Node };
        if (prop.type === 'RestElement' && prop.argument) patternNames(prop.argument, out);
        else if (prop.value) patternNames(prop.value, out);
      }
      break;
    case 'ArrayPattern':
      for (const el of (node as unknown as { elements: (Node | null)[] }).elements) {
        if (el) patternNames(el, out);
      }
      break;
    case 'AssignmentPattern':
      patternNames((node as unknown as { left: Node }).left, out);
      break;
    case 'RestElement':
      patternNames((node as unknown as { argument: Node }).argument, out);
      break;
  }
}

/** Names declared directly in this function/program scope (var/let/const,
 * params, inner function declarations) — not descending into nested functions. */
function ownScopeNames(fnNode: Node): string[] {
  const names: string[] = [];
  if (fnNode.params) for (const p of fnNode.params) if (isNode(p)) patternNames(p, names);

  const visit = (node: Node, isRoot: boolean) => {
    if (!isRoot && FN_TYPES.has(node.type)) {
      // record the inner function's name in THIS scope, don't descend
      if (node.type === 'FunctionDeclaration' && node.id?.name) names.push(node.id.name);
      return;
    }
    if (node.type === 'VariableDeclaration') {
      for (const d of (node as unknown as { declarations: { id: Node }[] }).declarations) {
        patternNames(d.id, names);
      }
    }
    for (const child of childNodes(node)) visit(child, false);
  };
  visit(fnNode, true);
  return [...new Set(names)].filter((n) => !RESERVED.has(n));
}

function snapshotExpr(names: string[]): string {
  if (names.length === 0) return '{}';
  const parts = names.map((n) => `${JSON.stringify(n)}:__cl_g(()=>${n})`);
  return `{${parts.join(',')}}`;
}

/** Instrument the source. Throws SyntaxError (with loc) on parse failure. */
export function instrument(source: string): string {
  const ast = acorn.parse(source, {
    ecmaVersion: 2022,
    sourceType: 'script',
    locations: true,
  }) as unknown as Node;

  const insertions: Insertion[] = [];
  let seq = 0;
  const scopeCache = new Map<Node, string[]>();

  const visibleNames = (ancestors: Node[]): string[] => {
    // union of every enclosing function scope (innermost last wins order-wise;
    // duplicates fine for object literal — last one wins, matching shadowing)
    const chain = [ast, ...ancestors.filter((a) => FN_TYPES.has(a.type))];
    const seen: string[] = [];
    for (const fn of chain) {
      let names = scopeCache.get(fn);
      if (!names) {
        names = ownScopeNames(fn);
        scopeCache.set(fn, names);
      }
      for (const n of names) if (!seen.includes(n)) seen.push(n);
    }
    return seen;
  };

  const stepCall = (line: number, ancestors: Node[]) =>
    `;__cl_step(${line},${snapshotExpr(visibleNames(ancestors))});`;

  fullAncestor(ast as unknown as acorn.Node, (rawNode, _state, rawAncestors) => {
    const node = rawNode as unknown as Node;
    const ancestors = rawAncestors as unknown as Node[];
    const parent = ancestors[ancestors.length - 2];
    const line = node.loc?.start.line ?? 0;

    // 1) a probe before every statement that sits in a block/program/case
    const isStatement =
      node.type.endsWith('Statement') ||
      node.type === 'VariableDeclaration' ||
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration';
    if (
      isStatement &&
      parent &&
      (parent.type === 'Program' ||
        parent.type === 'BlockStatement' ||
        parent.type === 'SwitchCase')
    ) {
      insertions.push({ pos: node.start, text: stepCall(line, ancestors), seq: seq++ });
    }

    // 2) loops: probe at the top of the body each iteration (catches
    //    `while(true){}` / single-statement bodies) + block-wrap bare bodies
    if (LOOP_TYPES.has(node.type)) {
      const body = (node as unknown as { body: Node }).body;
      if (body.type === 'BlockStatement') {
        insertions.push({ pos: body.start + 1, text: stepCall(line, ancestors), seq: seq++ });
      } else {
        insertions.push({ pos: body.start, text: `{${stepCall(line, ancestors)}`, seq: seq++ });
        insertions.push({ pos: body.end, text: `}`, seq: seq++ });
      }
    }

    // 3) if/else with bare (non-block) branches: wrap so branch lines trace
    if (node.type === 'IfStatement') {
      const { consequent, alternate } = node as unknown as {
        consequent: Node;
        alternate: Node | null;
      };
      for (const branch of [consequent, alternate]) {
        if (branch && branch.type !== 'BlockStatement' && branch.type !== 'IfStatement') {
          const bLine = branch.loc?.start.line ?? line;
          insertions.push({
            pos: branch.start,
            text: `{${stepCall(bLine, ancestors)}`,
            seq: seq++,
          });
          insertions.push({ pos: branch.end, text: `}`, seq: seq++ });
        }
      }
    }

    // 4) functions: enter/exit wrap for the call stack
    if (FN_TYPES.has(node.type)) {
      const body = (node as unknown as { body: Node }).body;
      if (body.type === 'BlockStatement') {
        let name = node.id?.name;
        if (!name) {
          // infer `const foo = () => {}` style names from the ancestor chain
          const p = ancestors[ancestors.length - 2] as unknown as {
            type?: string;
            id?: { type?: string; name?: string };
            key?: { name?: string };
          };
          if (p?.type === 'VariableDeclarator' && p.id?.type === 'Identifier') name = p.id.name;
          else if (p?.type === 'Property' && p.key?.name) name = p.key.name;
        }
        insertions.push({
          pos: body.start + 1,
          text: `__cl_enter(${JSON.stringify(name ?? '<fn>')},${line});try{`,
          seq: seq++,
        });
        insertions.push({ pos: body.end - 1, text: `;}finally{__cl_exit();}`, seq: seq++ });
      }
    }
  });

  // Probes fire BEFORE each statement, so without this the last statement's
  // effect would never be captured — append one final module-scope snapshot
  // (the JS analogue of Python's module return event).
  const programBody = (ast as unknown as { body: Node[] }).body;
  if (programBody.length > 0) {
    const endLine = programBody[programBody.length - 1].loc?.end.line ?? 1;
    insertions.push({
      pos: source.length,
      text: `\n;__cl_step(${endLine},${snapshotExpr(visibleNames([]))});`,
      seq: seq++,
    });
  }

  // apply back-to-front so earlier positions stay valid; same-position
  // insertions keep their recorded order
  insertions.sort((a, b) => b.pos - a.pos || b.seq - a.seq);
  let out = source;
  for (const ins of insertions) {
    out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  }
  return out;
}

/* -------------------------------------------------------------- execution */

class StopTrace extends Error {}

const TDZ = Symbol('tdz');

export function runJsTrace(source: string): JsTraceBody {
  let instrumented: string;
  try {
    instrumented = instrument(source);
  } catch (e: unknown) {
    const err = e as { message?: string; loc?: { line?: number; column?: number } };
    return {
      status: 'compile-error',
      diagnostics: [
        {
          type: 'SyntaxError',
          message: String(err.message ?? e).replace(/ \(\d+:\d+\)$/, ''),
          line: err.loc?.line ?? null,
          col: err.loc?.column ?? null,
        },
      ],
      steps: [],
    };
  }

  const steps: Step[] = [];
  const stack: { funcName: string; line: number }[] = [{ funcName: '<module>', line: 0 }];
  let out = '';
  let consumed = 0;
  let capped: TraceStatus | null = null;
  let lastLine = 0;

  const write = (args: unknown[]) => {
    if (out.length > MAX_OUTPUT) return;
    out += args.map((a) => (typeof a === 'string' ? a : reprOf(a))).join(' ') + '\n';
  };
  const fakeConsole = {
    log: (...a: unknown[]) => write(a),
    info: (...a: unknown[]) => write(a),
    warn: (...a: unknown[]) => write(a),
    error: (...a: unknown[]) => write(a),
  };

  const __cl_g = (get: () => unknown) => {
    try {
      return get();
    } catch {
      return TDZ; // let/const before initialization — not in scope yet
    }
  };

  const __cl_step = (line: number, vars: Record<string, unknown>) => {
    if (capped) throw new StopTrace();
    if (steps.length >= MAX_STEPS) {
      capped = 'step-cap';
      throw new StopTrace();
    }
    if (out.length > MAX_OUTPUT) {
      capped = 'output-cap';
      throw new StopTrace();
    }
    lastLine = line;
    stack[0].line = line;
    const locals: Step['locals'] = {};
    for (const [name, value] of Object.entries(vars)) {
      if (value === TDZ) continue;
      locals[name] = {
        repr: reprOf(value),
        type:
          kindOf(value) === 'scalar'
            ? typeof value
            : (value?.constructor?.name?.toLowerCase() ?? typeof value),
        kind: kindOf(value),
      };
    }
    steps.push({
      stepIndex: steps.length,
      line,
      funcName: stack[0].funcName,
      event: 'line',
      callStack: stack.map((f) => ({ funcName: f.funcName, line: f.line })),
      locals,
      stdout: out.slice(consumed),
    });
    consumed = out.length;
  };

  const __cl_enter = (name: string, line: number) => {
    stack.unshift({ funcName: name, line });
  };
  const __cl_exit = () => {
    if (stack.length > 1) stack.shift();
  };

  try {
    // Shadow worker/global escape hatches; user code sees only the sealed
    // console. The worker global is additionally network-stripped (js.worker).
    const fn = new Function(
      '__cl_step',
      '__cl_enter',
      '__cl_exit',
      '__cl_g',
      'console',
      'self',
      'globalThis',
      'window',
      'postMessage',
      'importScripts',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      '"use strict";\n' + instrumented,
    );
    fn(__cl_step, __cl_enter, __cl_exit, __cl_g, fakeConsole);
  } catch (e: unknown) {
    if (!(e instanceof StopTrace)) {
      const err = e as { constructor?: { name?: string }; message?: unknown };
      return {
        status: 'runtime-error',
        diagnostics: [
          {
            type: err?.constructor?.name ?? 'Error',
            message: String(err?.message ?? e),
            line: lastLine || null,
          },
        ],
        steps,
        finalStdout: out.slice(consumed),
      };
    }
  }

  return {
    status: capped ?? 'ok',
    diagnostics: [],
    steps,
    ...(out.length > consumed ? { finalStdout: out.slice(consumed) } : {}),
  };
}
