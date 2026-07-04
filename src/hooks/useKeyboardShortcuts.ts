import { useEffect } from 'react';
import { usePlayback } from '../state/playbackStore';

const SPEEDS = [1, 2, 4, 8, 16];

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.closest('.cm-editor') != null
  );
}

/**
 * Global playback shortcuts — active only when the editor / a form control is
 * NOT focused (PLAN.md §9.6). Space play/pause, ←/→ step, Home/End jump,
 * , / . speed.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = usePlayback.getState();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          s.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) s.jumpChange(-1);
          else s.stepBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) s.jumpChange(1);
          else s.stepForward();
          break;
        case 'Home':
          e.preventDefault();
          s.seek(0);
          break;
        case 'End':
          e.preventDefault();
          if (s.trace) s.seek(s.trace.steps.length - 1);
          break;
        case ',': {
          const i = SPEEDS.indexOf(s.speed);
          s.setSpeed(SPEEDS[Math.max(0, i - 1)]);
          break;
        }
        case '.': {
          const i = SPEEDS.indexOf(s.speed);
          s.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, i + 1)]);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
