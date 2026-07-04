import { describe, expect, it } from 'vitest';
import { buildShareLink, decodeShare } from './share';
import type { Trace } from '../types/trace';

const trace: Trace = {
  schemaVersion: 1,
  language: 'python',
  site: 'browser',
  status: 'ok',
  diagnostics: [],
  runtimeVersion: 'pyodide-test',
  steps: [
    {
      stepIndex: 0,
      line: 1,
      funcName: '<module>',
      event: 'line',
      callStack: [],
      locals: {},
      stdout: 'hi',
    },
  ],
};

const hashOf = (url: string) => url.slice(url.indexOf('#'));

describe('share codec', () => {
  it('round-trips source when there is no trace', () => {
    const link = buildShareLink('print(1)', null, 0);
    expect(link.mode).toBe('source');
    expect(decodeShare(hashOf(link.url))).toEqual({ kind: 'source', source: 'print(1)' });
  });

  it('embeds and round-trips a small trace with its source and step', () => {
    const link = buildShareLink('print("hi")', trace, 0);
    expect(link.mode).toBe('trace');
    const decoded = decodeShare(hashOf(link.url));
    expect(decoded?.kind).toBe('trace');
    if (decoded?.kind === 'trace') {
      expect(decoded.source).toBe('print("hi")');
      expect(decoded.trace.steps).toHaveLength(1);
      expect(decoded.step).toBe(0);
    }
  });

  it('returns null for empty or payload-less hashes', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#')).toBeNull();
    expect(decodeShare('#foo=bar')).toBeNull();
  });
});
