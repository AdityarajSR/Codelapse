import { create } from 'zustand';
import type { Trace } from '../types/trace';

/**
 * The single playback clock. One store drives the line highlight, the panels,
 * and (later) the 3D stage in lockstep — everything reads `index`.
 */
interface PlaybackState {
  trace: Trace | null;
  index: number;
  playing: boolean;
  /** steps per second */
  speed: number;

  setTrace: (t: Trace | null) => void;
  seek: (i: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
}

const lastIndex = (t: Trace | null) => (t && t.steps.length ? t.steps.length - 1 : 0);

export const usePlayback = create<PlaybackState>((set, get) => ({
  trace: null,
  index: 0,
  playing: false,
  speed: 4,

  setTrace: (t) => set({ trace: t, index: 0, playing: false }),

  seek: (i) => set({ index: Math.max(0, Math.min(i, lastIndex(get().trace))) }),

  stepForward: () => {
    const { trace, index } = get();
    if (!trace) return;
    if (index >= lastIndex(trace)) {
      set({ playing: false });
      return;
    }
    set({ index: index + 1 });
  },

  stepBack: () => set((s) => ({ index: Math.max(0, s.index - 1), playing: false })),

  play: () => {
    const { trace, index } = get();
    if (!trace || !trace.steps.length) return;
    set({ index: index >= lastIndex(trace) ? 0 : index, playing: true });
  },

  pause: () => set({ playing: false }),

  toggle: () => (get().playing ? get().pause() : get().play()),

  setSpeed: (s) => set({ speed: s }),
}));
