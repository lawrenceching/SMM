import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  requestConfirmation,
  respondConfirmation,
  abortConfirmation,
  _pendingConfirmationCount,
  _clearInflightConfirmationsForTests,
} from './confirmationBridge'

/**
 * Test the in-process confirmation bridge used by frontend AI tools
 * to surface Yes/No dialogs to the user.
 *
 * Pattern: in each test, register a `document` listener for
 * `smm-ai-confirmation-request`, call `requestConfirmation(...)`,
 * grab the requestId from the dispatched event, and call
 * `respondConfirmation(requestId, true|false)` to drive the
 * Promise to completion. `afterEach` calls `abortConfirmation` on
 * any pending requests (drained via a sentinel).
 */

interface CapturedRequest {
  requestId: string
  title: string
  message: string
}

let lastRequest: CapturedRequest | undefined

const onRequest = (event: Event) => {
  const ce = event as CustomEvent<CapturedRequest>
  lastRequest = ce.detail
}

afterEach(async () => {
  if (lastRequest) {
    // Resolve anything still pending so the test framework does
    // not see dangling promises.
    abortConfirmation(lastRequest.requestId)
  }
  lastRequest = undefined
  _clearInflightConfirmationsForTests()
  // Tiny delay to let any pending microtasks settle
  await new Promise((r) => setTimeout(r, 0))
})

describe('confirmationBridge', () => {
  it('dispatches a custom event with the request id, title and message', () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const promise = requestConfirmation('Hello world', { title: 'T' })
    document.removeEventListener('smm-ai-confirmation-request', onRequest)

    expect(lastRequest).toBeDefined()
    expect(lastRequest!.message).toBe('Hello world')
    expect(lastRequest!.title).toBe('T')
    expect(lastRequest!.requestId).toBeTruthy()

    // Cleanup
    void promise
  })

  it('resolves true when respondConfirmation is called with true', async () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const promise = requestConfirmation('msg')
    document.removeEventListener('smm-ai-confirmation-request', onRequest)
    const id = lastRequest!.requestId

    expect(respondConfirmation(id, true)).toBe(true)
    const result = await promise
    expect(result).toBe(true)
  })

  it('resolves false when respondConfirmation is called with false', async () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const promise = requestConfirmation('msg')
    document.removeEventListener('smm-ai-confirmation-request', onRequest)
    const id = lastRequest!.requestId

    expect(respondConfirmation(id, false)).toBe(true)
    const result = await promise
    expect(result).toBe(false)
  })

  it('returns false from respondConfirmation for unknown id', () => {
    expect(respondConfirmation('does-not-exist', true)).toBe(false)
  })

  it('abortConfirmation resolves a pending request as false', async () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const promise = requestConfirmation('msg')
    document.removeEventListener('smm-ai-confirmation-request', onRequest)
    const id = lastRequest!.requestId

    expect(abortConfirmation(id)).toBe(true)
    const result = await promise
    expect(result).toBe(false)
  })

  it('default title is "Confirmation"', () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const promise = requestConfirmation('msg')
    document.removeEventListener('smm-ai-confirmation-request', onRequest)
    expect(lastRequest!.title).toBe('Confirmation')
    void promise
  })

  it('_pendingConfirmationCount tracks live requests', async () => {
    const before = _pendingConfirmationCount()

    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const promise = requestConfirmation('msg')
    document.removeEventListener('smm-ai-confirmation-request', onRequest)

    expect(_pendingConfirmationCount()).toBe(before + 1)
    respondConfirmation(lastRequest!.requestId, true)
    const result = await promise
    expect(result).toBe(true)

    expect(_pendingConfirmationCount()).toBe(before)
  })

  it('responds to multiple parallel requests independently', async () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const p1 = requestConfirmation('first')
    const id1 = lastRequest!.requestId

    const p2 = requestConfirmation('second')
    const id2 = lastRequest!.requestId
    document.removeEventListener('smm-ai-confirmation-request', onRequest)

    expect(id1).not.toBe(id2)

    respondConfirmation(id2, true)
    respondConfirmation(id1, false)

    expect(await p1).toBe(false)
    expect(await p2).toBe(true)
  })

  it('dedupes parallel requests with the same title and message', async () => {
    document.addEventListener('smm-ai-confirmation-request', onRequest)
    const p1 = requestConfirmation('same message', { title: 'T' })
    const p2 = requestConfirmation('same message', { title: 'T' })
    document.removeEventListener('smm-ai-confirmation-request', onRequest)

    expect(lastRequest).toBeDefined()
    const id = lastRequest!.requestId

    respondConfirmation(id, true)
    expect(await p1).toBe(true)
    expect(await p2).toBe(true)
  })

  // Suppress unused-import warning
  void vi
})
