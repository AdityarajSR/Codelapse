/**
 * Tiny UI sound effects, synthesized with the Web Audio API — no audio files,
 * nothing to download. They only ever play right after a click (browsers
 * require that anyway), stay quiet, and respect Lisa's mute button.
 */
import { isMuted } from '../assistant/speech';

export type Sfx = 'whoosh' | 'tick' | 'done';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A soft filtered-noise sweep — the spotlight gliding to the next control. */
function whoosh(ac: AudioContext) {
  const t = ac.currentTime;
  const dur = 0.32;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(2600, t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, vol: number) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function sfx(kind: Sfx) {
  if (isMuted()) return;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return; // people who ask for less motion usually want less flourish, too
  }
  const ac = audio();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    if (kind === 'whoosh') whoosh(ac);
    else if (kind === 'tick') tone(ac, 880, t, 0.06, 0.05);
    else {
      // a bright little major arpeggio
      tone(ac, 659.25, t, 0.16, 0.07);
      tone(ac, 830.61, t + 0.09, 0.16, 0.07);
      tone(ac, 987.77, t + 0.18, 0.32, 0.07);
    }
  } catch {
    // audio unavailable — silently skip
  }
}
