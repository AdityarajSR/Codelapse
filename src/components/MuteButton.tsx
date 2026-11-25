import { useEffect } from 'react';
import { canSpeak, setMuted, stopSpeaking, useMuted, useSpeaking } from '../assistant/speech';
import { SpeakerIcon } from './MicButton';

/**
 * Lisa's voice on/off, in the top bar. Muting stops her mid-sentence and turns
 * off automatic speech; Escape also stops whatever is being read.
 */
export function MuteButton() {
  const muted = useMuted();
  const speaking = useSpeaking();

  useEffect(() => {
    if (!speaking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopSpeaking();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [speaking]);

  if (!canSpeak()) return null;

  const label = muted ? 'Unmute Lisa' : speaking ? 'Mute Lisa (stops speaking)' : 'Mute Lisa';
  return (
    <button
      type="button"
      className={`muteBtn${muted ? ' is-muted' : ''}${speaking ? ' is-speaking' : ''}`}
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={label}
      title={label}
    >
      <SpeakerIcon size={16} off={muted} />
    </button>
  );
}
