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
