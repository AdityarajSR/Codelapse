import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildShareLink } from '../lib/share';
import { usePlayback } from '../state/playbackStore';

type GifState = 'idle' | 'working' | 'done' | 'unavailable';

interface ShareDialogProps {
  onClose: () => void;
  source: string;
}

/**
 * Mounted only while open (lazy-loaded from App). The trace + step are
 * snapshotted once on mount — so the GIF exporter can seek the playback clock
 * without this dialog re-rendering or regenerating the link/QR per frame.
 */
export function ShareDialog({ onClose, source }: ShareDialogProps) {
  const [snap] = useState(() => {
    const s = usePlayback.getState();
    return { trace: s.trace, step: s.index };
  });
  const link = useMemo(() => buildShareLink(source, snap.trace, snap.step), [source, snap]);

  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gif, setGif] = useState<GifState>('idle');
  const [gifPct, setGifPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    QRCode.toDataURL(link.url, {
      margin: 1,
      width: 160,
      color: { dark: '#0b0b14', light: '#e8e8f0' },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  // Focus the link field on open; restore focus to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  };

  const exportGif = async () => {
    setGif('working');
    setGifPct(0);
    try {
      // gifenc + capture code load only when someone actually exports.
      const { exportStageGif, downloadBlob } = await import('../lib/gifExport');
      const blob = await exportStageGif(setGifPct);
      if (!blob) {
        setGif('unavailable');
        return;
      }
      downloadBlob(blob, 'codelapse.gif');
      setGif('done');
    } catch {
      setGif('unavailable');
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share this run"
      >
        <div className="dialog__head">
          <h2>Share this run</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="dialog__mode">
          {link.mode === 'trace'
            ? '▶ Replayable link — opens to this exact run, nothing re-executes.'
            : 'Shares your code — it opens behind a “press play” gate and never auto-runs.'}
        </p>

        <div className="field">
          <input
            ref={inputRef}
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button className="btn btn--run" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {link.tooLong && (
          <p className="dialog__warn">
            This program is large, so the link may be truncated by some chat apps. Copy the code
            directly if the link doesn’t open.
          </p>
        )}

        <div className="dialog__export">
          <button className="btn btn--ghost" onClick={exportGif} disabled={gif === 'working'}>
            {gif === 'working' ? `Rendering GIF… ${Math.round(gifPct * 100)}%` : 'Download GIF'}
          </button>
          {gif === 'unavailable' && (
            <span className="dialog__hint">Switch the stage to 3D to export a GIF.</span>
          )}
          {gif === 'done' && <span className="dialog__hint">Saved codelapse.gif ✓</span>}
        </div>

        {qr && (
          <div className="dialog__qr">
            <img src={qr} alt="QR code for the share link" width={160} height={160} />
            <span>Scan to open on a phone</span>
          </div>
        )}
      </div>
    </div>
  );
}
