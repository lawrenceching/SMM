// hono/bun (serveStatic) reads the Bun global at module import time.
// CLI unit tests run under Node via vitest, so provide a minimal stub.
// Production runs under real Bun — this file is never loaded there.
if (typeof (globalThis as { Bun?: unknown }).Bun === 'undefined') {
  ;(globalThis as { Bun?: unknown }).Bun = {
    write: () => {},
    version: 'vitest-stub',
  }
}
