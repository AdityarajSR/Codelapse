/**
 * Instant, AI-free explanations of the current execution step.
 *
 * Everything here is derived from the recorded trace, so it is free, works
 * offline and can't contradict what the panels show. Text uses `backticks` for
 * code, rendered by the assistant panel's inline formatter.
 *
 * Trace semantics (both tracers): a step's `line` is the line ABOUT to run and
 * its locals are the state BEFORE it runs — so what changed between step i-1
 * and step i was done by step i-1's line.
 */
import type { Diagnostic, Language, Step, Trace, VarSnapshot } from '../types/trace';

export type PointKind = 'line' | 'change' | 'flow' | 'stack' | 'output' | 'error' | 'done';

export interface NarrationPoint {
  kind: PointKind;
  text: string;
}

export interface Narration {
  headline: string;
  points: NarrationPoint[];
}

/* ------------------------------------------------------------ helpers -- */

const MAX_VAL = 48;
const short = (s: string) => (s.length <= MAX_VAL ? s : s.slice(0, MAX_VAL - 1) + '…');
const code = (s: string) => '`' + short(s).replace(/`/g, "'") + '`';

/** Values that are definitions, not data — not worth narrating. */
const HIDDEN_TYPES = new Set(['function', 'builtin_function_or_method', 'module', 'type', 'class']);
const isData = (v: VarSnapshot) => !HIDDEN_TYPES.has(v.type) && !v.repr.startsWith('<function');

const fnLabel = (name: string) => (name === '<module>' ? 'the main program' : code(`${name}()`));

export function lineText(source: string, line: number): string {
  return (source.split('\n')[line - 1] ?? '').trim();
}

const isBlankOrComment = (t: string, lang: Language) =>
  t === '' || (lang === 'python' ? t.startsWith('#') : t.startsWith('//'));

/** The next line after `line` that holds real code. */
function nextCodeLine(source: string, line: number, lang: Language): number {
  const lines = source.split('\n');
  for (let n = line + 1; n <= lines.length; n++) {
    const t = lines[n - 1].trim();
    if (!isBlankOrComment(t, lang) && t !== '{') return n;
  }
  return line + 1;
}

type Header = 'for' | 'while' | 'if' | 'elif' | 'else' | null;

function headerKind(text: string): Header {
  if (/^for\b/.test(text)) return 'for';
  if (/^while\b/.test(text)) return 'while';
  if (/^(}\s*)?else\s+if\b/.test(text) || /^elif\b/.test(text)) return 'elif';
  if (/^if\b/.test(text)) return 'if';
  if (/^(}\s*)?else\b/.test(text)) return 'else';
  return null;
}

const stripColon = (s: string) => s.replace(/:\s*(#.*)?$/, '').trim();
const stripParens = (s: string) =>
  s
    .replace(/^\(/, '')
    .replace(/\)\s*\{?\s*$/, '')
    .trim();

/* ------------------------------------------------ describe a statement -- */

/** Plain-language description of what a single line does. */
export function describeLine(text: string, lang: Language): string {
  const t = text.trim();
  if (t === '') return 'an empty line';

  if (lang === 'python') {
    let m = /^def\s+(\w+)\s*\((.*)\)\s*:/.exec(t);
    if (m) {
      return `defines the function ${code(m[1] + '()')}${m[2].trim() ? ` with parameter${m[2].includes(',') ? 's' : ''} ${code(m[2].trim())}` : ''}. The body does not run until the function is called.`;
    }
    m = /^class\s+(\w+)/.exec(t);
    if (m) return `defines the class ${code(m[1])}.`;
    m = /^for\s+(.+?)\s+in\s+(.+):/.exec(t);
    if (m) {
      return `a ${code('for')} loop header: takes the next item from ${code(m[2])} and stores it in ${code(m[1])}. If there are no items left, the loop ends.`;
    }
    m = /^while\s+(.+):/.exec(t);
    if (m) {
      return `a ${code('while')} loop: checks ${code(stripColon(m[1]))}. If it is True the loop body runs (again); if False the loop ends.`;
    }
    m = /^(?:if|elif)\s+(.+):/.exec(t);
    if (m) {
      return `checks the condition ${code(stripColon(m[1]))}. If it is True, the indented block below runs; otherwise it is skipped.`;
    }
    if (/^else\s*:/.test(t))
      return 'the `else` branch: runs only when the conditions above were all False.';
    m = /^return\b\s*(.*)$/.exec(t);
    if (m) {
      return m[1]
        ? `returns ${code(m[1])} to whoever called this function, and the function stops here.`
        : 'leaves the function (returns `None`).';
    }
    if (/^print\s*\(/.test(t)) return 'prints a value to the output.';
    if (/^(break)\b/.test(t)) return '`break`: jumps out of the nearest loop immediately.';
    if (/^(continue)\b/.test(t))
      return '`continue`: skips the rest of this loop round and starts the next one.';
    if (/^pass\b/.test(t)) return '`pass`: does nothing (a placeholder).';
    if (/^(import|from)\b/.test(t)) return 'imports code from a module.';
    m = /^([\w.[\]'"]+)\.(append|extend|insert|pop|remove|add|update|sort|reverse|clear)\s*\(/.exec(
      t,
    );
    if (m) return describeMethod(m[1], m[2]);
  } else {
    let m = /^(?:async\s+)?function\s*\*?\s*(\w+)\s*\((.*)\)/.exec(t);
    if (m) {
      return `defines the function ${code(m[1] + '()')}${m[2].trim() ? ` with parameter${m[2].includes(',') ? 's' : ''} ${code(m[2].trim())}` : ''}. The body does not run until the function is called.`;
    }
    m = /^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/.exec(t);
    if (m)
      return `defines the arrow function ${code(m[1] + '()')}. Its body runs only when called.`;
    m = /^class\s+(\w+)/.exec(t);
    if (m) return `defines the class ${code(m[1])}.`;
    m = /^for\s*\((.*)\)/.exec(t);
    if (m) {
      const inner = m[1];
      const of = /^(?:const|let|var)?\s*(\w+)\s+(of|in)\s+(.+)$/.exec(inner.trim());
      if (of) {
        return of[2] === 'of'
          ? `a ${code('for…of')} loop: takes the next item from ${code(of[3])} and stores it in ${code(of[1])}.`
          : `a ${code('for…in')} loop: takes the next key of ${code(of[3])} and stores it in ${code(of[1])}.`;
      }
      const parts = inner.split(';').map((p) => p.trim());
      if (parts.length === 3) {
        return `a ${code('for')} loop: starts with ${code(parts[0] || '—')}, keeps going while ${code(parts[1] || 'true')}, and does ${code(parts[2] || '—')} after each round.`;
      }
      return `a ${code('for')} loop header.`;
    }
    m = /^while\s*\((.*)\)/.exec(t);
    if (m) {
      return `a ${code('while')} loop: checks ${code(m[1])}. If it is true the loop body runs (again); if false the loop ends.`;
    }
    m = /^(?:}\s*else\s+)?if\s*(\(.*\))/.exec(t);
    if (m) {
      return `checks the condition ${code(stripParens(m[1]))}. If it is true, the block runs; otherwise it is skipped.`;
    }
    if (/^}?\s*else\b/.test(t))
      return 'the `else` branch: runs only when the conditions above were all false.';
    m = /^return\b\s*(.*?);?$/.exec(t);
    if (m) {
      return m[1]
        ? `returns ${code(m[1])} to whoever called this function, and the function stops here.`
        : 'leaves the function (returns `undefined`).';
    }
    if (/^console\.(log|info|warn|error)\s*\(/.test(t)) return 'prints a value to the output.';
    if (/^break\b/.test(t)) return '`break`: jumps out of the nearest loop immediately.';
    if (/^continue\b/.test(t))
      return '`continue`: skips the rest of this loop round and starts the next one.';
    m = /^([\w.[\]'"]+)\.(push|pop|shift|unshift|splice|sort|reverse|set|add|delete)\s*\(/.exec(t);
    if (m) return describeMethod(m[1], m[2]);
    m = /^(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?$/.exec(t);
    if (m) return `creates the variable ${code(m[1])} and stores ${code(m[2])} in it.`;
  }

  // shared: augmented assignment, plain assignment, tuple swap, bare call
  let m = /^([\w.[\]'"]+)\s*([+\-*/%]|\/\/|\*\*)=\s*(.+?);?$/.exec(t);
  if (m) {
    const verb: Record<string, string> = {
      '+': 'adds',
      '-': 'subtracts',
      '*': 'multiplies by',
      '/': 'divides by',
      '//': 'floor-divides by',
      '%': 'takes the remainder after dividing by',
      '**': 'raises to the power of',
    };
    return m[2] === '+' || m[2] === '-'
      ? `${verb[m[2]]} ${code(m[3])} ${m[2] === '+' ? 'to' : 'from'} ${code(m[1])} and stores the result back in ${code(m[1])}.`
      : `updates ${code(m[1])}: ${verb[m[2]] ?? 'combines it with'} ${code(m[3])} and stores the result back in ${code(m[1])}.`;
  }
  m = /^([\w\s,]+?)\s*=\s*([^=].*?);?$/.exec(t);
  if (m && m[1].includes(',')) {
    return `assigns several variables at once: ${code(m[1].trim())} get the values of ${code(m[2])}.`;
  }
  m = /^([\w.[\]'"]+)\s*=\s*([^=].*?);?$/.exec(t);
  if (m) {
    return /\[|\./.test(m[1])
      ? `updates ${code(m[1])} to ${code(m[2])}.`
      : `works out ${code(m[2])} and stores the result in ${code(m[1])}.`;
  }
  m = /^([\w.]+)\s*\(/.exec(t);
  if (m) return `calls ${code(m[1] + '()')}.`;
  return `runs ${code(t)}.`;
}

function describeMethod(target: string, method: string): string {
  const what: Record<string, string> = {
    append: `adds an item to the end of the list ${code(target)}.`,
    push: `adds an item to the end of the array ${code(target)}.`,
    extend: `adds several items to the end of ${code(target)}.`,
    insert: `inserts an item into ${code(target)} at a given position.`,
    pop: `removes (and returns) an item from ${code(target)}.`,
    shift: `removes the first item of ${code(target)}.`,
    unshift: `adds an item to the front of ${code(target)}.`,
    remove: `removes the first matching item from ${code(target)}.`,
    splice: `removes or inserts items inside ${code(target)}.`,
    add: `adds an item to the set ${code(target)}.`,
    update: `adds several entries to ${code(target)}.`,
    set: `stores a key/value pair in ${code(target)}.`,
    delete: `deletes an entry from ${code(target)}.`,
    sort: `sorts ${code(target)} in place.`,
    reverse: `reverses ${code(target)} in place.`,
    clear: `empties ${code(target)}.`,
  };
  return what[method] ?? `calls ${code(`${target}.${method}()`)}.`;
}

/* ------------------------------------------------------- error advice -- */

export interface ErrorAdvice {
  meaning: string;
  fix: string;
}

const ERROR_ADVICE: Record<string, ErrorAdvice> = {
  ZeroDivisionError: {
    meaning: 'The program tried to divide by zero, which has no answer.',
    fix: 'Check that the divisor is not 0 before dividing (for example with an `if`).',
  },
  IndexError: {
    meaning: 'The program asked for a position in a list that does not exist.',
    fix: 'Valid positions go from `0` to `len(list) - 1`. Check your loop range or index math (off-by-one is common).',
  },
  KeyError: {
    meaning: 'The program looked up a key that is not in the dictionary.',
    fix: 'Check the key spelling, add the key first, or use `.get(key, default)`.',
  },
  NameError: {
    meaning: 'The program used a name that has not been defined yet.',
    fix: 'Check the spelling, and make sure the variable is assigned (or the function defined) before this line.',
  },
  UnboundLocalError: {
    meaning: 'A variable was used inside a function before it was given a value there.',
    fix: 'Assign it first inside the function, or pass it in as a parameter.',
  },
  TypeError: {
    meaning:
      'An operation was used on a value of the wrong type (for example adding a number to a string, or calling something that is not a function).',
    fix: 'Look at the types in the Variables panel and convert where needed, e.g. `str(n)` or `int(text)`.',
  },
  ValueError: {
    meaning: 'A value had the right type but an unusable content (for example `int("abc")`).',
    fix: 'Check the value before converting it.',
  },
  AttributeError: {
    meaning: 'The program used a method or property that this kind of value does not have.',
    fix: 'Check the spelling and the type of the value — e.g. lists have `.append`, strings do not.',
  },
  RecursionError: {
    meaning: 'A function kept calling itself and never stopped (too many nested calls).',
    fix: 'Make sure the recursive function has a base case that is reached, and that each call moves closer to it.',
  },
  RangeError: {
    meaning:
      'A value was outside the allowed range — often endless recursion ("Maximum call stack size exceeded").',
    fix: 'Make sure recursive functions have a base case that is reached.',
  },
  ReferenceError: {
    meaning:
      'The program used a variable that does not exist (or before `let`/`const` created it).',
    fix: 'Check the spelling and declare the variable before using it.',
  },
  SyntaxError: {
    meaning: 'The code is not written in a form the language understands, so it could not start.',
    fix: 'Look for a missing bracket, quote, colon or comma near the reported line (sometimes the real mistake is on the line before).',
  },
  IndentationError: {
    meaning: "Python uses indentation to group code, and this line's indentation does not fit.",
    fix: 'Indent blocks consistently (4 spaces) under `if`, `for`, `def` and similar lines.',
  },
};

export function adviceFor(type: string): ErrorAdvice {
  return (
    ERROR_ADVICE[type] ?? {
      meaning: 'The program stopped because of an error.',
      fix: 'Read the message, look at the variables at this step, and try the "Find bugs" button in Ask AI.',
    }
  );
}

function errorPoint(d: Diagnostic): NarrationPoint {
  const a = adviceFor(d.type);
  return {
    kind: 'error',
    text: `${code(d.type)}${d.line ? ` on line ${d.line}` : ''}: ${d.message ? `"${short(d.message)}". ` : ''}${a.meaning} Fix: ${a.fix}`,
  };
}

/* -------------------------------------------------------- the narrator -- */

function sameFrame(a: Step, b: Step) {
  return a.callStack.length === b.callStack.length && a.funcName === b.funcName;
}

/** How many loop rounds have reached `line` in this frame, counted back to
 * when execution last arrived from above the loop. */
function loopRound(steps: Step[], i: number): number {
  const { line } = steps[i];
  const depth = steps[i].callStack.length;
  let rounds = 0;
  for (let j = i; j >= 0; j--) {
    const s = steps[j];
    if (s.callStack.length < depth) break;
    if (s.callStack.length > depth) continue;
    if (s.line === line) rounds++;
    else if (s.line < line) break;
  }
  return rounds;
}

/** Explain step `index` of `trace` for a beginner. */
export function narrateStep(trace: Trace | null, index: number, source: string): Narration {
  if (!trace) {
    return { headline: 'Press Run to start tracing your code.', points: [] };
  }
  const lang = trace.language;
  const steps = trace.steps;

  if (steps.length === 0) {
    const diag = trace.diagnostics[0];
    if (diag) {
      return {
        headline:
          trace.status === 'compile-error'
            ? 'The code could not start — it has a syntax problem.'
            : 'The program stopped before running any line.',
        points: [errorPoint(diag)],
      };
    }
    return { headline: 'Nothing ran — the program has no executable lines.', points: [] };
  }

  const i = Math.max(0, Math.min(index, steps.length - 1));
  const cur = steps[i];
  const prev = i > 0 ? steps[i - 1] : undefined;
  const text = lineText(source, cur.line);
  const points: NarrationPoint[] = [];
  const isLast = i === steps.length - 1;

  let headline: string;
  const deeper = prev && cur.callStack.length > prev.callStack.length;
  const shallower = prev && cur.callStack.length < prev.callStack.length;
  // Python reports the main program itself as a 'call' — that's just the start.
  const enteredFunction = (cur.event === 'call' || deeper) && cur.funcName !== '<module>';

  if (cur.event === 'return') {
    headline = `${fnLabel(cur.funcName)} is finishing (line ${cur.line}).`;
  } else if (enteredFunction) {
    headline = `${fnLabel(cur.funcName)} was just called.`;
  } else if (shallower && prev) {
    headline = `Back in ${fnLabel(cur.funcName)} after ${fnLabel(prev.funcName)} finished.`;
  } else if (i === 0) {
    headline = text
      ? `The program starts. Line ${cur.line} runs first.`
      : 'The program starts. Press ▶ or → to run the first line.';
  } else {
    headline = `Line ${cur.line} runs next.`;
  }
  headline = headline.charAt(0).toUpperCase() + headline.slice(1);

  // 1. What the upcoming line does.
  if (cur.event !== 'return' && text) {
    points.push({
      kind: 'line',
      text: `Line ${cur.line} ${code(text)} ${describeLine(text, lang)}`,
    });
  }

  // 2. What the previous line did (only meaningful within the same frame).
  if (prev && sameFrame(prev, cur) && prev.event !== 'return') {
    const prevText = lineText(source, prev.line);
    for (const [name, snap] of Object.entries(cur.locals)) {
      if (!isData(snap)) continue;
      const before = prev.locals[name];
      if (!before) {
        points.push({
          kind: 'change',
          text: `${code(name)} was created by line ${prev.line} with the value ${code(snap.repr)}.`,
        });
      } else if (before.repr !== snap.repr) {
        points.push({
          kind: 'change',
          text: `${code(name)} changed from ${code(before.repr)} to ${code(snap.repr)} because of line ${prev.line}${prevText ? ` (${code(prevText)})` : ''}.`,
        });
      }
    }

    // 3. Control flow: loops and branches.
    if (prev.event === 'line' || prev.event === 'call') {
      const ph = headerKind(prevText);
      const fallThrough = cur.line === nextCodeLine(source, prev.line, lang);
      const curHeader = headerKind(text);

      if (cur.line < prev.line && (curHeader === 'for' || curHeader === 'while')) {
        const round = loopRound(steps, i);
        points.push({
          kind: 'flow',
          text: `The loop body finished, so execution jumped back up from line ${prev.line} to the loop header on line ${cur.line} (loop check #${round}).`,
        });
      } else if (cur.line < prev.line && prev.event === 'line') {
        points.push({
          kind: 'flow',
          text: `Execution jumped back from line ${prev.line} to line ${cur.line}.`,
        });
      } else if (ph === 'if' || ph === 'elif') {
        points.push({
          kind: 'flow',
          text: fallThrough
            ? `The condition on line ${prev.line} was **true**, so its block runs.`
            : `The condition on line ${prev.line} was **false**, so its block was skipped.`,
        });
      } else if (ph === 'while') {
        points.push({
          kind: 'flow',
          text: fallThrough
            ? `The \`while\` condition on line ${prev.line} was **true**, so the loop body runs.`
            : `The \`while\` condition on line ${prev.line} was **false**, so the loop is over.`,
        });
      } else if (ph === 'for') {
        points.push({
          kind: 'flow',
          text: fallThrough
            ? `The \`for\` loop on line ${prev.line} got its next item, so the body runs.`
            : `The \`for\` loop on line ${prev.line} has no items left, so the loop is over.`,
        });
      }
    }
  }

  // 4. The call stack.
  if (enteredFunction) {
    const caller = cur.callStack[1];
    const params = Object.entries(cur.locals)
      .filter(([, v]) => isData(v))
      .map(([n, v]) => `${n} = ${short(v.repr)}`);
    points.push({
      kind: 'stack',
      text:
        `${fnLabel(cur.funcName)} was called${caller ? ` from line ${caller.line} of ${fnLabel(caller.funcName)}` : ''}` +
        (params.length ? ` with ${code(params.join(', '))}` : '') +
        `. It gets its own fresh set of variables. The call stack is now ${cur.callStack.length} deep.`,
    });
  } else if (cur.event === 'return') {
    const caller = cur.callStack[1];
    points.push({
      kind: 'stack',
      text: caller
        ? `When it finishes, its result goes back to line ${caller.line} of ${fnLabel(caller.funcName)}, and its local variables disappear.`
        : 'The main program has run all its lines.',
    });
  } else if (shallower && prev) {
    points.push({
      kind: 'stack',
      text: `${fnLabel(prev.funcName)} returned, so its variables are gone and we continue in ${fnLabel(cur.funcName)} on line ${cur.line}. The call stack is now ${cur.callStack.length} deep.`,
    });
  } else if (cur.callStack.length > 1) {
    const chain = [...cur.callStack]
      .reverse()
      .map((f) => (f.funcName === '<module>' ? 'main' : `${f.funcName}()`))
      .join(' → ');
    points.push({
      kind: 'stack',
      text: `We are inside ${fnLabel(cur.funcName)}. Call chain: ${code(chain)}.`,
    });
  }

  // 5. Output produced since the previous step.
  if (cur.stdout) {
    const printed = cur.stdout.replace(/\n$/, '');
    points.push({
      kind: 'output',
      text: `${prev ? `Line ${prev.line}` : 'The program'} printed ${code(printed.split('\n').join(' ⏎ '))}.`,
    });
  }

  // 6. End of the run.
  if (isLast) {
    if (trace.status === 'runtime-error' && trace.diagnostics[0]) {
      points.push(errorPoint(trace.diagnostics[0]));
    } else if (trace.status === 'step-cap') {
      points.push({
        kind: 'error',
        text: 'The trace stopped here because the program ran too many steps. This usually means an infinite loop — check that the loop condition eventually becomes false.',
      });
    } else if (trace.status === 'output-cap') {
      points.push({
        kind: 'done',
        text: 'The trace stopped because the program printed too much.',
      });
    } else {
      points.push({ kind: 'done', text: 'This is the last step — the program finished.' });
    }
  }

  return { headline, points };
}
