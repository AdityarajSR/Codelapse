import { useEffect, useState } from 'react';

const ASKING = [
  'Thinking',
  'Reading your code',
  'Tracing the loops',
  'Whirring',
  'Following the variables',
  'Untangling the logic',
  'Checking the call stack',
  'Connecting the dots',
  'Brewing an answer',
  'Almost there',
];

const WRITING = [
  'Sketching the idea',
  'Writing the code',
  'Picking good variable names',
  'Whirring',
  'Adding comments',
  'Testing it in my head',
  'Polishing',
  'Almost there',
];

/**
 * The "working on it" indicator: a pulsing spark, shimmering text and a
 * rotating status word, so a long answer feels alive rather than stuck.
 */
export function Thinking({ kind = 'ask', label }: { kind?: 'ask' | 'write'; label?: string }) {
  const words = kind === 'write' ? WRITING : ASKING;
  const [i, setI] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const words = setInterval(() => setI((n) => n + 1), 1800);
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(words);
      clearInterval(clock);
    };
  }, []);

  const word = words[i % words.length];
  return (
    <span className="thinking" role="status" aria-live="polite">
      <span className="thinking__orb" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"
          />
        </svg>
      </span>
      <span className="thinking__text" key={word}>
        {label ?? word}
        <span className="thinking__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </span>
      {seconds >= 3 && <span className="thinking__time">{seconds}s</span>}
    </span>
  );
}
