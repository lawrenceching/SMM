import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Radix UI primitives (e.g. TooltipContent) use ResizeObserver in jsdom-incompatible ways.
// Provide a no-op polyfill for test environments that lack it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})
