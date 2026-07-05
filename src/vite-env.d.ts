/// <reference types="vite/client" />

// Raw text imports (Vite). The Python tracer source is imported into the worker
// as a string via `?raw`.
declare module '*.py?raw' {
  const src: string;
  export default src;
}

declare module '*.woff?url' {
  const src: string;
  export default src;
}

// gifenc ships no type declarations.
declare module 'gifenc' {
  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): GifEncoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
  ): Uint8Array;
}
