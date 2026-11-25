import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders code inside bold text instead of showing backticks', () => {
    const { container } = render(
      <Markdown text={'- **Line 1 (`def fib(n):`):** defines `fib`.'} />,
    );
    const strong = container.querySelector('strong')!;
    expect(strong.textContent).toBe('Line 1 (def fib(n):):');
    expect(strong.querySelector('code')?.textContent).toBe('def fib(n):');
    expect(container.textContent).not.toContain('`');
  });

  it('renders lists, headings and fenced code', () => {
    const { container } = render(
      <Markdown text={'### Title\n\n1. one\n2. two\n\n```python\nx = 1\n```'} />,
    );
    expect(container.querySelector('h4')?.textContent).toBe('Title');
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
    expect(container.querySelector('pre code')?.textContent).toBe('x = 1');
  });
});
