/**
 * Math and code notation, made readable and speakable.
 *
 * Models sometimes write LaTeX (`$O(n^2)$`, `\log n`). `plainMath` turns that
 * into clean text for the screen; `speakMath` turns notation into words for
 * the voice ("big O of n squared", "left less than or equal to right").
 */

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  n: 'ⁿ',
  k: 'ᵏ',
};

function latexToText(tex: string): string {
  return tex
    .replace(/\\(?:left|right)\s*/g, '')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq?/g, '≠')
    .replace(/\\infty/g, '∞')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\(?:text|mathrm|mathit|operatorname)\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\^\{([^}]*)\}/g, (_, p: string) =>
      [...p].every((c) => SUPERSCRIPT[c]) ? [...p].map((c) => SUPERSCRIPT[c]).join('') : `^${p}`,
    )
    .replace(/\^([0-9nk])/g, (_, c: string) => SUPERSCRIPT[c])
    .replace(/\\[,;!: ]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Replace LaTeX math ($…$, $$…$$, \(…\), \[…\]) with plain text. Code
 * fences are left untouched. */
export function plainMath(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => latexToText(t))
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, t: string) => latexToText(t))
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, t: string) => latexToText(t))
            // $…$ only when it looks like math (not "$5 and $10"): the usual
            // Markdown rule — no space just inside the $s, no digit right after
            .replace(/\$(?!\s)([^$\n]*?[\\^_{}a-zA-Z(][^$\n]*?)(?<!\s)\$(?!\d)/g, (_, t: string) =>
              latexToText(t),
            )
            // bare O(n^2) outside $…$
            .replace(
              /\b([OΘΩ])\(([^()]*(?:\([^()]*\))?[^()]*)\)/g,
              (m, o: string, inner: string) =>
                inner.includes('^') || inner.includes('\\') ? `${o}(${latexToText(inner)})` : m,
            ),
    )
    .join('');
}

const POWER_WORDS: Record<string, string> = {
  '²': ' squared',
  '³': ' cubed',
  '⁴': ' to the power 4',
  ⁿ: ' to the power n',
  ᵏ: ' to the power k',
};

function speakExpr(expr: string): string {
  return expr
    .replace(/([²³⁴ⁿᵏ])/g, (c) => POWER_WORDS[c])
    .replace(/\^\s*2\b/g, ' squared')
    .replace(/\^\s*3\b/g, ' cubed')
    .replace(/\^\s*(\w+)/g, ' to the power $1')
    .replace(/\s*[·×*]\s*/g, ' times ')
    .replace(/√\(?([^)\s]+)\)?/g, 'square root of $1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turn notation into words for speech. Run on plain text (no Markdown). */
export function speakMath(text: string): string {
  return (
    plainMath(text)
      // complexity: O(n log n) → "big O of n log n"
      .replace(/\b([OΘΩ])\(([^()]*(?:\([^()]*\))?[^()]*)\)/g, (_, o: string, inner: string) => {
        const name = o === 'O' ? 'big O' : o === 'Θ' ? 'big theta' : 'big omega';
        return ` ${name} of ${speakExpr(inner)} `;
      })
      // comparisons and operators, as a teacher would say them
      .replace(/\s*(<=|≤)\s*/g, ' less than or equal to ')
      .replace(/\s*(>=|≥)\s*/g, ' greater than or equal to ')
      .replace(/\s*(!==|!=|≠)\s*/g, ' not equal to ')
      .replace(/\s*(===|==)\s*/g, ' equals ')
      .replace(/\s*(->|=>|→)\s*/g, ' to ')
      .replace(/\s+\/\/\s+/g, ' floor divided by ')
      .replace(/\s+%\s+/g, ' mod ')
      .replace(/\s+\/\s+/g, ' divided by ')
      .replace(/\s*×\s*/g, ' times ')
      .replace(/\s+\*\*\s+/g, ' to the power ')
      .replace(/\s+\*\s+/g, ' times ')
      .replace(/\s+\+=\s+/g, ' plus equals ')
      .replace(/\s+-=\s+/g, ' minus equals ')
      .replace(/\s+<\s+/g, ' less than ')
      .replace(/\s+>\s+/g, ' greater than ')
      // indexing: seq[i - 1] → "seq at index i minus 1"
      .replace(/([A-Za-z_]\w*)\[([^\][]+)\]/g, '$1 at index $2')
      .replace(/(\w)\s+-\s+(\w)/g, '$1 minus $2')
      .replace(/[²³⁴ⁿᵏ]/g, (c) => POWER_WORDS[c])
      .replace(/\s+/g, ' ')
      .trim()
  );
}
