import { useEffect } from 'react';
import { useSpeechInput } from '../assistant/speech';
import './Lisa.css';

export function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpeakerIcon({ size = 14, off = false }: { size?: number; off?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {off ? (
        <path
          d="M16.5 9.5l5 5m0-5l-5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

interface MicButtonProps {
  /** receives the full sentence once the student stops speaking */
  onText: (text: string) => void;
  /** live transcript while speaking (for showing in the input) */
  onInterim?: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Tap to talk. Hidden entirely in browsers without speech recognition
 * (e.g. Firefox), so it never shows a button that can't work.
 */
export function MicButton({ onText, onInterim, disabled, className = '' }: MicButtonProps) {
  const mic = useSpeechInput();
  const { listening, interim } = mic;

  // Mirror the live transcript into the parent's input while speaking.
  useEffect(() => {
    if (listening) onInterim?.(interim);
  }, [listening, interim, onInterim]);

  if (!mic.supported) return null;

  const toggle = () => {
    if (mic.listening) {
      mic.stop();
      return;
    }
    mic.start(onText);
  };

  return (
    <span className={`mic ${className}`}>
      <button
        type="button"
        className={`mic__btn${mic.listening ? ' is-listening' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-pressed={mic.listening}
        aria-label={mic.listening ? 'Stop listening' : 'Speak your question'}
        title={
          mic.listening
            ? 'Listening… tap to stop'
            : 'Speak (your browser turns speech into text — Chrome/Edge send audio to Google/Microsoft for this)'
        }
      >
        <MicIcon />
      </button>
      {mic.error && (
        <span className="mic__error" role="alert">
          {mic.error}
        </span>
      )}
    </span>
  );
}
