import { describe, expect, it } from 'vitest'
import { waitFor } from './waitFor'

describe('waitFor', () => {
  it('resolves when callback succeeds on first try', async () => {
    const result = await waitFor(() => 'ok')
    expect(result).toBe('ok')
  })

  it('retries until callback succeeds', async () => {
    let attempts = 0
    const result = await waitFor(
      () => {
        attempts++
        if (attempts < 3) {
          throw new Error('not ready')
        }
        return 'ready'
      },
      { timeout: 5_000, interval: 10 },
    )
    expect(result).toBe('ready')
    expect(attempts).toBe(3)
  })

  it('rejects with last error when timeout elapses', async () => {
    await expect(
      waitFor(
        () => {
          throw new Error('still failing')
        },
        { timeout: 50, interval: 10 },
      ),
    ).rejects.toThrow('still failing')
  })

  it('supports async callbacks', async () => {
    let attempts = 0
    const result = await waitFor(
      async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('pending')
        }
        return 42
      },
      { timeout: 5_000, interval: 10 },
    )
    expect(result).toBe(42)
  })
})
