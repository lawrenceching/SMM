import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { attachDownloadServiceWorkerUpdateChecks } from './downloadServiceWorker'

describe('attachDownloadServiceWorkerUpdateChecks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls registration.update on attach, focus, and interval', () => {
    const onActivated = vi.fn()
    const swListeners = new Map<string, EventListener>()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: (type: string, fn: EventListener) => swListeners.set(type, fn),
        removeEventListener: (type: string) => swListeners.delete(type),
      },
    })
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration

    const detach = attachDownloadServiceWorkerUpdateChecks(registration, onActivated)

    expect(registration.update).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('focus'))
    expect(registration.update).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(3)

    detach()
  })
})
