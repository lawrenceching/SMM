import { useEffect } from 'react'
import { useDialogs } from '@/providers/dialog-provider'
import { abortConfirmation, respondConfirmation } from './confirmationBridge'
import type { ConfirmationRequest } from './confirmationBridge'

/** Tracks the in-flight AI confirmation so a superseding request can abort it. */
let activeRequestId: string | null = null

/**
 * React bridge between the in-process `requestConfirmation()` call
 * (made by AI tools' `execute` functions) and the in-app
 * `ConfirmationDialog` (which needs React context).
 *
 * Mounts a single `document` listener for the
 * `smm-ai-confirmation-request` custom event. When a tool requests
 * confirmation, this component opens the dialog with Yes/No
 * buttons. The user's response is forwarded back to the awaiting
 * `execute` call via `respondConfirmation()`.
 */
export function AIBasedConfirmationBridge() {
  const { confirmationDialog } = useDialogs()
  const [openConfirmation, closeConfirmation] = confirmationDialog

  useEffect(() => {
    const onRequest = (event: Event) => {
      const customEvent = event as CustomEvent<ConfirmationRequest>
      const request = customEvent.detail
      if (!request || !request.requestId) return

      if (activeRequestId === request.requestId) {
        return
      }

      const previousRequestId = activeRequestId
      if (previousRequestId && previousRequestId !== request.requestId) {
        abortConfirmation(previousRequestId)
      }
      activeRequestId = request.requestId

      let settled = false
      const settle = (confirmed: boolean) => {
        if (settled) return
        settled = true
        respondConfirmation(request.requestId, confirmed)
        if (activeRequestId === request.requestId) {
          activeRequestId = null
        }
      }

      openConfirmation({
        title: request.title,
        description: request.message,
        showCloseButton: false,
        onClose: () => {
          settle(false)
        },
        content: (
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                settle(false)
                closeConfirmation()
              }}
            >
              No
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                settle(true)
                closeConfirmation()
              }}
            >
              Yes
            </button>
          </div>
        ),
      })
    }

    document.addEventListener(
      'smm-ai-confirmation-request',
      onRequest as EventListener,
    )
    return () => {
      document.removeEventListener(
        'smm-ai-confirmation-request',
        onRequest as EventListener,
      )
    }
  }, [openConfirmation, closeConfirmation])

  return null
}
