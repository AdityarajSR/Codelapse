/**
 * Shared motion switches for the stages.
 *
 * - Reduced motion: respect the OS setting — boxes snap to their slots
 *   instead of gliding.
 * - Snap mode: the GIF exporter seeks step-by-step and reads the canvas two
 *   rAFs later; without snapping, every captured frame would catch boxes
 *   mid-flight. The exporter flips this on for the duration of the capture.
 */

let snap = false;

export function setStageSnap(on: boolean) {
  snap = on;
}

const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function motionDisabled(): boolean {
  return snap || reducedMotion;
}
