import { useEffect, useState } from 'react';

const KEY = 'codelapse.welcomed.v1';

/** A one-time, dismissible welcome card — the first-run "what am I looking at"
 * cue (PLAN.md §9.6). Remembered in localStorage so it shows only once. */
export function Coachmarks() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* storage blocked — just don't show */
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="coach" role="dialog" aria-label="Welcome to Codelapse">
      <div className="coach__badge" aria-hidden="true" />
      <h3>Watch your code run</h3>
      <ul>
        <li>
          Edit the code, then press <strong>Run</strong> — or <kbd>Space</kbd> to play.
        </li>
        <li>
          Drag the <strong>timeline</strong> to step through; variables flash as they change.
        </li>
        <li>
          The <strong>3D stage</strong> shows your lists and dicts as physical objects.
        </li>
      </ul>
      <button className="btn btn--run" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
