import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { buildShareLink } from '../lib/share';
import type { Trace } from '../types/trace';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  source: string;
  trace: Trace | null;
  step: number;
}

export function ShareDialog({ open, onClose, source, trace, step }: ShareDialogProps) {
  const link = useMemo(
    () => (open ? buildShareLink(source, trace, step) : null),
    [open, source, trace, step],
  );
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
    if (open && link) {
      QRCode.toDataURL(link.url, {
        margin: 1,
        width: 160,
        color: { dark: '#0b0b12', light: '#e8e8f0' },
      })
        .then(setQr)
        .catch(() => setQr(null));
    }
  }, [open, link]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !link) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
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
          <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
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
