import { memo } from 'react';
import { usePlayback } from '../state/playbackStore';
import { CodeEditor } from './CodeEditor';

interface EditorCardProps {
  code: string;
  onChange: (value: string) => void;
}

/**
 * Subscribes only to the active line (a primitive), so a playback tick
 * re-renders this card and nothing above it.
 */
export const EditorCard = memo(function EditorCard({ code, onChange }: EditorCardProps) {
  const activeLine = usePlayback((s) => (s.trace ? (s.trace.steps[s.index]?.line ?? null) : null));
  const live = usePlayback((s) => s.trace != null);

  return (
    <div className="card card--editor">
      <div className="editor__chrome">
        <span className={`editor__dot${live ? ' editor__dot--live' : ''}`} aria-hidden="true" />
        <span className="editor__tab">main.py</span>
        <span className="editor__meta">Python · runs in your browser</span>
      </div>
      <div className="editor__body">
        <CodeEditor value={code} onChange={onChange} activeLine={activeLine} />
      </div>
    </div>
  );
});
