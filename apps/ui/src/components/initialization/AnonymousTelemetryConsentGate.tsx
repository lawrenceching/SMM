import { useCallback } from "react"
import { toast } from "sonner"
import { useConfig } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import { shouldShowAnonymousTelemetryConsent } from "@/lib/anonymousTelemetryConsent"
import { AnonymousTelemetryConsentDialog } from "@/components/dialogs/AnonymousTelemetryConsentDialog"

/**
 * Shows the anonymous telemetry consent dialog once when
 * `userConfig.anonymousTelemetryConsent` is still undefined.
 */
export function AnonymousTelemetryConsentGate() {
  const {
    userConfig,
    isLoading,
    isUserConfigLoaded,
    setAndSaveUserConfig,
  } = useConfig()
  // Dialog visibility is derived from config state: it stays open while consent
  // is still undefined (including after a failed save) and closes once a choice
  // has been persisted.
  const isOpen =
    !isLoading &&
    isUserConfigLoaded &&
    shouldShowAnonymousTelemetryConsent(userConfig.anonymousTelemetryConsent)

  const persist = useCallback(
    async (value: boolean) => {
      const next = { ...userConfig, anonymousTelemetryConsent: value }
      const traceId = `AnonymousTelemetryConsent-${nextTraceId()}`
      try {
        await setAndSaveUserConfig(traceId, next)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message)
        // If consent is still unset after failure the dialog stays open so the user can retry
      }
    },
    [setAndSaveUserConfig, userConfig],
  )

  const onAgree = useCallback(() => {
    void persist(true)
  }, [persist])

  const onDisagree = useCallback(() => {
    void persist(false)
  }, [persist])

  return (
    <AnonymousTelemetryConsentDialog
      isOpen={isOpen}
      onAgree={onAgree}
      onDisagree={onDisagree}
    />
  )
}
