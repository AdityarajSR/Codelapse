/**
 * Voice in and out, using the browser's built-in Web Speech API (free, no key).
 *
 * - Speaking (speechSynthesis) works in all modern browsers, offline.
 * - Listening (SpeechRecognition) works in Chrome, Edge and Safari; Firefox
 *   has none, so mic buttons hide themselves there. Note: Chrome and Edge send
 *   the audio to Google / Microsoft to transcribe it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { plainMath, speakMath } from './mathText';

/* ------------------------------------------------------------- speaking -- */

/**
 * Markdown → text that sounds natural when read aloud. Every line (heading,
 * bullet, paragraph) ends as a sentence, so the voice pauses between points
 * instead of running them together.
 */
export function toSpeakable(markdown: string): string {
  return (
    plainMath(markdown)
      .replace(/```[\s\S]*?```/g, '\nThe code is on your screen.\n')
      .split('\n')
      .map((line) =>
        line
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2')
          .replace(/^\s*#{1,6}\s+/, '')
          .replace(/^\s*[-*•]\s+/, '')
          .replace(/^\s*\d+[.)]\s+/, '')
          .replace(/[⏎▲▶]/g, ' '),
      )
      // "O(n²)" → "big O of n squared", "a <= b" → "a less than or equal to b"
      .map((line) => speakMath(line))
      .filter(Boolean)
      .map((line) => (/[.!?:;]$/.test(line) ? line : `${line}.`))
      .join(' ')
  );
}

/** Sentence-sized pieces: natural pauses, and Chrome won't cut off long speech. */
export function speechChunks(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    if (cur && (cur + ' ' + s).length > max) {
      out.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Lisa's voice: a natural-sounding female English voice. Browsers don't
 * expose gender, so match well-known female voice names.
 *
 * What makes a voice sound human matters more than which accent it has: the
 * neural "Natural"/"Online" voices (Edge) and Google's voices (Chrome) sound
 * far less robotic than the old offline ones (Zira, Heera), so those win
 * first; within each group Indian English comes first.
 */
const FEMALE_VOICES = [
  /neerja/i,
  /google.*english.*india|google.*en-in/i,
  /heera/i,
  /\b(aria|jenny|ava|emma|michelle|sonia|libby|natasha|clara)\b/i,
  /google uk english female|google us english/i,
  /samantha|victoria|karen|moira|tessa|serena|fiona/i,
  /swara|veena/i,
  /zira|hazel|susan/i,
  /female|woman/i,
];

const isNatural = (v: SpeechSynthesisVoice) => /natural|neural|online|google/i.test(v.name);

export function lisaVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const rank = (v: SpeechSynthesisVoice) => {
    const i = FEMALE_VOICES.findIndex((re) => re.test(v.name));
    const female = i === -1 ? FEMALE_VOICES.length : i;
    // natural female < natural other < offline female < offline other
    return (isNatural(v) ? 0 : 100) + female;
  };
  return [...english].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** Natural voices already sound right at a brisk pace; old offline voices
 * drag, so they get a bit more speed. Pitch stays neutral — raising it is
 * what makes a voice sound synthetic. */
function voiceSettings(v: SpeechSynthesisVoice | null) {
  return v && isNatural(v) ? { rate: 1.1, pitch: 1 } : { rate: 1.15, pitch: 1 };
}

// Voices load asynchronously in some browsers; touching the list early
// makes them ready by the time Lisa first speaks.
if (canSpeak()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });
}

type SpeakListener = (speaking: boolean) => void;
const listeners = new Set<SpeakListener>();
const notify = (on: boolean) => listeners.forEach((l) => l(on));

/* --------------------------------------------------------------- mute -- */

const MUTE_KEY = 'codelapse.voice.muted';
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const muteListeners = new Set<(m: boolean) => void>();

export const isMuted = () => muted;

/** Mute stops Lisa mid-sentence and turns off automatic speech. Speaker
 * buttons the student taps themselves still work. */
export function setMuted(on: boolean) {
  muted = on;
  if (on) stopSpeaking();
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0');
  } catch {
    // not remembered — fine
  }
  muteListeners.forEach((l) => l(on));
}

export function useMuted(): boolean {
  const [m, setM] = useState(muted);
  useEffect(() => {
    muteListeners.add(setM);
    return () => {
      muteListeners.delete(setM);
    };
  }, []);
  return m;
}

/**
 * Read text (Markdown allowed) aloud, replacing anything already speaking.
 * `manual: true` = the student tapped a speaker button, so it plays even when
 * muted; automatic speech (answers, Lisa's replies) respects mute.
 */
export function speak(markdown: string, { manual = false }: { manual?: boolean } = {}) {
  if (!canSpeak() || (muted && !manual)) return;
  const text = toSpeakable(markdown);
  if (!text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = lisaVoice(synth.getVoices());
  const { rate, pitch } = voiceSettings(voice);
  const chunks = speechChunks(text);
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.voice = voice;
    if (voice) u.lang = voice.lang;
    u.rate = rate;
    u.pitch = pitch;
    if (i === 0) u.onstart = () => notify(true);
    if (i === chunks.length - 1) u.onend = () => notify(false);
    u.onerror = () => notify(false);
    synth.speak(u); // queued: plays one after another
  });
}

export function stopSpeaking() {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  notify(false);
}

/** True while something is being read aloud. */
export function useSpeaking(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    listeners.add(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

/* ------------------------------------------------------------ listening -- */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognitionCtor() !== null;

const MIC_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone permission was blocked. Allow it in the address bar and try again.',
  'service-not-allowed': 'Voice input is blocked in this browser.',
  'no-speech': "I didn't hear anything — tap the mic and speak again.",
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection.',
};

export interface Listening {
  supported: boolean;
  listening: boolean;
  /** live text while speaking */
  interim: string;
  error: string | null;
  /** start listening; `onFinal` gets the full sentence when the user stops */
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
}

/** One-shot speech-to-text: tap, speak a sentence, get the text. */
export function useSpeechInput(lang = 'en-IN'): Listening {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const supported = canListen();

  useEffect(() => () => recRef.current?.abort(), []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = recognitionCtor();
      if (!Ctor) {
        setError('Voice input is not supported in this browser. Try Chrome or Edge.');
        return;
      }
      recRef.current?.abort();
      stopSpeaking(); // don't transcribe our own voice
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '';
      rec.onresult = (e) => {
        let live = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else live += r[0].transcript;
        }
        setInterim((finalText + ' ' + live).trim());
      };
      rec.onerror = (e) => {
        if (e.error !== 'aborted') setError(MIC_ERRORS[e.error] ?? 'Voice input failed.');
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
        recRef.current = null;
        const text = finalText.trim();
        if (text) onFinal(text);
      };
      recRef.current = rec;
      setError(null);
      setInterim('');
      setListening(true);
      try {
        rec.start();
      } catch {
        setListening(false);
        setError('Could not start the microphone.');
      }
    },
    [lang],
  );

  return { supported, listening, interim, error, start, stop };
}
