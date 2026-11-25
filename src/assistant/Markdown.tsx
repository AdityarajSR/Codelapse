/**
 * A deliberately tiny Markdown renderer for assistant answers. It builds React
 * elements (never raw HTML), so model output can't inject markup. Supports
 * what the system prompt asks for: paragraphs, bullet / numbered lists,
 * headings, fenced code, `inline code`, **bold** and *italic*.
 */
import { Fragment, type ReactNode } from 'react';
import { plainMath } from './mathText';

/** Inline formatting only — for one-line explanations. */
export function Inline({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

/** Inline formatting: `code`, **bold**, *italic* / _italic_. */
function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\b_[^_\n]+_\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;
    // bold/italic can contain `code` (e.g. **Line 1 (`def f():`)**) — recurse
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>);
    else out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'code'; text: string; lang: string }
  | { type: 'ul' | 'ol'; items: string[] };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*```(\w*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      blocks.push({ type: 'code', text: body.join('\n'), lang: fence[1] });
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'h', text: heading[1] });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const type = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)![1];
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === type) prev.items.push(item);
      else blocks.push({ type, items: [item] });
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    // indented continuation of a list item
    const prev = blocks[blocks.length - 1];
    if (
      para.length === 0 &&
      prev &&
      (prev.type === 'ul' || prev.type === 'ol') &&
      /^\s{2,}/.test(line)
    ) {
      prev.items[prev.items.length - 1] += ' ' + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  // LaTeX math ($O(n^2)$) → plain text (O(n²)) — we don't ship a math renderer.
  const blocks = parseBlocks(plainMath(text));
  return (
    <div className="md">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return <p key={i}>{renderInline(b.text, `p${i}`)}</p>;
          case 'h':
            return <h4 key={i}>{renderInline(b.text, `h${i}`)}</h4>;
          case 'code':
            return (
              <pre key={i} className="md__code">
                <code>{b.text}</code>
              </pre>
            );
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Fragment>{renderInline(item, `l${i}-${j}`)}</Fragment>
                  </li>
                ))}
              </List>
            );
          }
        }
      })}
    </div>
  );
}
