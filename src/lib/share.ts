import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Language, Trace } from '../types/trace';

/**
 * Hybrid share model (PLAN.md §9.11):
 *  - embed the precomputed TRACE (+ source) when it fits the URL → the viewer
 *    REPLAYS it: safe (no execution) and reproducible;
 *  - otherwise fall back to SOURCE only → the viewer opens behind a press-play
 *    gate and runs it locally in the network-stripped worker (never auto-run).
 */

const MAX_TRACE_ENCODED = 14000;
const URL_WARN_LENGTH = 8000;

export type Shared =
  | { kind: 'source'; source: string; language: Language }
  | { kind: 'trace'; source: string; trace: Trace; step: number };

export interface ShareLink {
  url: string;
  mode: 'trace' | 'source';
  tooLong: boolean;
}

function baseUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function decodeShare(hash: string): Shared | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  const params = new URLSearchParams(h);
  const t = params.get('t');
  const c = params.get('c');
  try {
    if (t) {
      const json = decompressFromEncodedURIComponent(t);
      if (!json) return null;
      const payload = JSON.parse(json) as { src: string; trace: Trace };
      const step = Number(params.get('s') ?? '0') || 0;
      return { kind: 'trace', source: payload.src, trace: payload.trace, step };
    }
    if (c) {
      const source = decompressFromEncodedURIComponent(c);
      if (source == null) return null;
      const language: Language = params.get('l') === 'javascript' ? 'javascript' : 'python';
      return { kind: 'source', source, language };
    }
  } catch {
    return null;
  }
  return null;
}

function sourceLink(source: string, language: Language): ShareLink {
  const c = compressToEncodedURIComponent(source);
  const lang = language === 'python' ? '' : `&l=${language}`;
  const url = `${baseUrl()}#c=${c}${lang}`;
  return { url, mode: 'source', tooLong: url.length > URL_WARN_LENGTH };
}

export function buildShareLink(
  source: string,
  trace: Trace | null,
  step: number,
  language: Language = 'python',
): ShareLink {
  if (trace && trace.steps.length) {
    const encoded = compressToEncodedURIComponent(JSON.stringify({ src: source, trace }));
    if (encoded.length <= MAX_TRACE_ENCODED) {
      return { url: `${baseUrl()}#t=${encoded}&s=${step}`, mode: 'trace', tooLong: false };
    }
  }
  return sourceLink(source, language);
}
