/** Short, relatable "did you know?" facts — shared by the navbar chip and the
 * first-run welcome modal. Kept punchy so they fit a pill without wrapping. */
export const FACTS = [
  'Your code runs entirely in your browser — nothing is ever uploaded.',
  "Python is named after Monty Python's Flying Circus, not the snake.",
  'The first computer bug, in 1947, was a real moth stuck in a relay.',
  "JavaScript was created in just ten days, and we've patched it ever since.",
  'An infinite `while True:` loop is the fastest way to freeze a program.',
  'Bubble sort is one of the slowest sorts — and the most fun to watch run.',
  'Array indexes start at 0, the classic source of off-by-one bugs.',
  'Ada Lovelace wrote the first algorithm in 1843, before computers existed.',
  'Binary search finds one item among a thousand in only about ten steps.',
  'A stack overflow is a real runtime error, not just a website for coders.',
  'To understand recursion, you must first understand recursion.',
  "10 kinds of people exist: those who read binary, and those who don't.",
];

export function randomFact(): string {
  return FACTS[Math.floor(Math.random() * FACTS.length)];
}
