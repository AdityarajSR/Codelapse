import type { VarSnapshot } from '../types/trace';

/** A parsed, renderable data structure derived from a variable's repr. */
export type Structure =
  | { name: string; kind: 'array' | 'set' | 'string'; items: string[] }
  | { name: string; kind: 'dict'; pairs: [string, string][] };

/** Split a repr body on top-level commas (respecting nesting and quotes). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && s[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    else if (ch === ']' || ch === '}' || ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function topColon(s: string): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === inStr && s[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === '[' || ch === '{' || ch === '(') depth++;
    else if (ch === ']' || ch === '}' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}

function inner(repr: string, open: string, close: string): string | null {
  const s = repr.trim();
  if (!s.startsWith(open) || !s.endsWith(close)) return null;
  return s.slice(1, -1).trim();
}

export function parseStructure(name: string, snap: VarSnapshot): Structure | null {
  if (snap.kind === 'array') {
    const body = inner(snap.repr, '[', ']');
    if (body == null) return null;
    return { name, kind: 'array', items: body === '' ? [] : splitTop(body) };
  }
  if (snap.kind === 'set') {
    const body = inner(snap.repr, '{', '}');
    if (body == null) return null;
    return { name, kind: 'set', items: body === '' ? [] : splitTop(body) };
  }
  if (snap.kind === 'dict') {
    const body = inner(snap.repr, '{', '}');
    if (body == null) return null;
    const pairs =
      body === ''
        ? []
        : (splitTop(body).map((p) => {
            const idx = topColon(p);
            return idx === -1 ? [p, ''] : [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
          }) as [string, string][]);
    return { name, kind: 'dict', pairs };
  }
  if (snap.kind === 'string') {
    const s = snap.repr;
    const unq = s.length >= 2 && (s[0] === "'" || s[0] === '"') ? s.slice(1, -1) : s;
    return { name, kind: 'string', items: [...unq] };
  }
  return null;
}

export function structureSize(st: Structure): number {
  return st.kind === 'dict' ? st.pairs.length : st.items.length;
}

/** Choose the most visually interesting structure to feature on the stage. */
export function pickPrimary(locals: Record<string, VarSnapshot>): Structure | null {
  let best: Structure | null = null;
  let bestScore = -1;
  for (const [name, snap] of Object.entries(locals)) {
    const st = parseStructure(name, snap);
    if (!st) continue;
    const kindWeight =
      st.kind === 'array' ? 100 : st.kind === 'dict' ? 80 : st.kind === 'set' ? 70 : 40;
    const score = kindWeight + Math.min(structureSize(st), 30);
    if (score > bestScore) {
      bestScore = score;
      best = st;
    }
  }
  return best;
}
