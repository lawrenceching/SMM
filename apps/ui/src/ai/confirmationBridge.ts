/**
 * Bridge between in-process AI tools (running outside the React tree)
 * and the in-app confirmation dialog (which needs React context).
 *
 * Problem:
 *
 * Frontend AI tools registered with `makeAssistantTool` have their
 * `execute` function called by `streamText` running in the browser
 * (see `apps/ui/src/ai/transport/reverseProxyChatTransport.ts`).
 * That call site is *outside* the React tree, so the tool cannot
 * use `useDialogs().openConfirmation(...)` directly.
 *
 * The backend equivalent in `ChatTask.ts` solves the same problem by
 * sending a Socket.IO `askForConfirmation` event and waiting for the
 * client to acknowledge it through `acknowledge()`. The client-side
 * listener lives in `WebSocketHandlers` (`apps/ui/src/main.tsx`) and
 * opens the dialog.
 *
 * Solution (this module):
 *
 * Mirror that pattern, but in-process. The tool calls
 * `requestConfirmation({ message })`, which:
 *
 *   1. Generates a unique `requestId`.
 *   2. Stores a `Promise<boolean>` resolver in a module-level map.
 *   3. Dispatches a `CustomEvent` on `document` carrying the request
 *      payload and id. A React listener (`<AIBasedConfirmationBridge />`)
 *      picks it up, calls `useDialogs().openConfirmation(...)`, and
 *      resolves the promise via `respondConfirmation(requestId, ...)`.
 *
 * The tool's `execute` function awaits the promise, which resolves
 * with `true` (Yes) or `false` (No).
 *
 * This is the frontend equivalent of the backend's Socket.IO +
 * `acknowledge()` flow.
 */

export interface ConfirmationRequest {
  requestId: string
  title: string
  message: string
}

interface PendingConfirmation {
  resolve: (confirmed: boolean) => void
  dedupeKey: string
}

const pending = new Map<string, PendingConfirmation>()
/** In-flight confirmations keyed by title+message so duplicate tool executes share one dialog. */
const inflightByKey = new Map<string, Promise<boolean>>()

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `confirm-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function confirmationDedupeKey(message: string, title: string): string {
  return `${title}\0${message}`
}

function clearInflight(key: string): void {
  inflightByKey.delete(key)
}

/**
 * Request user confirmation. Resolves to `true` (Yes) or `false` (No).
 *
 * @param message Confirmation message shown to the user.
 * @param options Optional title; defaults to a generic "Confirmation" header.
 */
export function requestConfirmation(
  message: string,
  options: { title?: string } = {},
): Promise<boolean> {
  const title = options.title ?? "Confirmation"
  const dedupeKey = confirmationDedupeKey(message, title)

  const existing = inflightByKey.get(dedupeKey)
  if (existing) {
    return existing
  }

  const promise = new Promise<boolean>((resolve) => {
    const requestId = makeId()
    pending.set(requestId, {
      dedupeKey,
      resolve: (confirmed) => {
        clearInflight(dedupeKey)
        resolve(confirmed)
      },
    })

    const request: ConfirmationRequest = {
      requestId,
      title,
      message,
    }

    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('smm-ai-confirmation-request', { detail: request }),
      )
    } else {
      pending.delete(requestId)
      clearInflight(dedupeKey)
      resolve(false)
    }
  })

  inflightByKey.set(dedupeKey, promise)
  return promise
}

/**
 * Resolve a pending confirmation request. Called by
 * `<AIBasedConfirmationBridge />` when the user clicks Yes/No.
 *
 * @returns `true` if the request was found and resolved, `false` if
 *   the id was unknown (already resolved or never registered).
 */
export function respondConfirmation(
  requestId: string,
  confirmed: boolean,
): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  pending.delete(requestId)
  clearInflight(entry.dedupeKey)
  entry.resolve(confirmed)
  return true
}

/**
 * Reject a pending confirmation without a user response (e.g. the
 * bridge component unmounted or the tool's `abortSignal` fired). The
 * promise resolves to `false`, matching the "No / cancelled" outcome
 * the tool's caller expects.
 */
export function abortConfirmation(requestId: string): boolean {
  return respondConfirmation(requestId, false)
}

/**
 * For tests / debugging only: returns the number of pending
 * confirmation requests. Do not use in production logic.
 */
export function _pendingConfirmationCount(): number {
  return pending.size
}

/**
 * For tests only: clears in-flight dedupe entries.
 */
export function _clearInflightConfirmationsForTests(): void {
  inflightByKey.clear()
}
