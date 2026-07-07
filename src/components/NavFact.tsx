import { useEffect, useState } from 'react';
import { FACTS } from '../lib/facts';
import { BulbIcon } from './Icons';

/**
 * A small rotating "did you know?" chip in the navbar. Starts on a random fact
 * (so it differs per browser/session) and gently cross-fades to the next one
 * every so often. Static under prefers-reduced-motion; hidden on narrow screens
 * (CSS) so it can never crowd the header.
 */
export function NavFact() {
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setShown(false);
      window.setTimeout(() => {
        setI((x) => (x + 1) % FACTS.length);
        setShown(true);
      }, 320);
    }, 11000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className={`navFact${shown ? ' navFact--in' : ''}`} title="Did you know?">
      <span className="navFact__bulb" aria-hidden="true">
        <BulbIcon size={16} />
      </span>
      <span className="navFact__text">{FACTS[i]}</span>
    </span>
  );
}
