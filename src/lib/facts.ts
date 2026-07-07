/** Short, relatable "did you know?" facts — shared by the navbar chip and the
 * first-run welcome modal. Kept punchy so they fit a pill without wrapping. */
export const FACTS = [
  'Your code never leaves your browser.',
  'Python is named after Monty Python.',
  'The first computer bug was a real moth.',
  'JavaScript was built in just 10 days.',
  '`while True:` freezes a program fast.',
  'Bubble sort is slow but fun to watch.',
  "Arrays start at 0. You'll get used to it.",
  'Ada Lovelace wrote code back in 1843.',
  'Off-by-one is the classic coding bug.',
  'Binary search: 1,000 items, ~10 steps.',
  "A stack overflow isn't just a website.",
  'To understand recursion, see recursion.',
];

export function randomFact(): string {
  return FACTS[Math.floor(Math.random() * FACTS.length)];
}
