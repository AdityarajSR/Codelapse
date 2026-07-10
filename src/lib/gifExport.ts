import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { setStageSnap } from '../stage/motion';
import { usePlayback } from '../state/playbackStore';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Client-side GIF export of the 3D stage across the whole run (zero backend —
 * the locked viral/teacher feature, PLAN.md §9.11). Walks the playback clock,
 * captures the WebGL canvas per sampled step, and encodes with gifenc.
 *
 * Requires the 3D stage to be active (`preserveDrawingBuffer` is enabled so the
 * canvas can be read back). Returns null if there's no canvas or trace.
 */
export async function exportStageGif(onProgress?: (p: number) => void): Promise<Blob | null> {
  const gl = document.querySelector<HTMLCanvasElement>('.stage3d canvas');
  const store = usePlayback.getState();
  const trace = store.trace;
  if (!gl || !trace || trace.steps.length === 0) return null;

  const startIndex = store.index;
  const total = trace.steps.length;
  const maxFrames = 90;
  const every = Math.max(1, Math.ceil(total / maxFrames));

  const indices: number[] = [];
  for (let i = 0; i < total; i += every) indices.push(i);
  if (indices[indices.length - 1] !== total - 1) indices.push(total - 1);

  const scale = Math.min(1, 480 / gl.width);
  const w = Math.max(2, Math.round(gl.width * scale));
  const h = Math.max(2, Math.round(gl.height * scale));

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const gif = GIFEncoder();
  // Quantize the palette ONCE (the scene keeps the same violet/cyan family
  // throughout) and reuse it for every frame — quantize is by far the most
  // expensive gifenc call, so this is a 3-5x export speedup.
  let palette: number[][] | null = null;
  // Snap stage motion for the capture — we seek step-by-step and read the
  // canvas two rAFs later, so gliding boxes would be mid-flight in every frame.
  setStageSnap(true);
  try {
    for (let k = 0; k < indices.length; k++) {
      store.seek(indices[k]);
      // let React re-render and r3f draw the frame before we read it back
      await nextFrame();
      await nextFrame();
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(gl, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      if (!palette) palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, w, h, { palette, delay: 130 });
      onProgress?.((k + 1) / indices.length);
    }
    gif.finish();
    return new Blob([gif.bytes() as unknown as BlobPart], { type: 'image/gif' });
  } finally {
    setStageSnap(false);
    store.seek(startIndex);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
