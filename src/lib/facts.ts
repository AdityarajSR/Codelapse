/** Short, relatable "did you know?" facts — shared by the navbar chip and the
 * first-run welcome modal. Kept punchy so they fit a pill without wrapping. */
export const FACTS = [
  'Your code runs in your browser — nothing is uploaded.',
  'Python is named after Monty Python, not the snake.',
  'The first computer bug was a real moth, in 1947.',
  'JavaScript was created in just 10 days, back in 1995.',
  '`while True:` is the #1 way to freeze a program.',
  'Bubble sort is slow — but oddly satisfying to watch.',
  'Arrays start at 0. You never fully forgive this.',
  'Ada Lovelace wrote the first algorithm in 1843.',
  'Off-by-one errors are the most common bug in code.',
  'Binary search: 1,000 items, about 10 steps. Magic.',
  'A stack overflow is real, not just a website.',
  'To understand recursion, first understand recursion.',
];

export function randomFact(): string {
  return FACTS[Math.floor(Math.random() * FACTS.length)];
}
