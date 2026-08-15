import { useCallback, useEffect, useState } from "react"
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
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isLoading || !isUserConfigLoaded) return
    if (shouldShowAnonymousTelemetryConsent(userConfig.anonymousTelemetryConsent)) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }, [
    isLoading,
    isUserConfigLoaded,
    userConfig.anonymousTelemetryConsent,
  ])

  const persist = useCallback(
    async (value: boolean) => {
      const previous = userConfig.anonymousTelemetryConsent
      const next = { ...userConfig, anonymousTelemetryConsent: value }
      const traceId = `AnonymousTelemetryConsent-${nextTraceId()}`
      setIsOpen(false)
      try {
        await setAndSaveUserConfig(traceId, next)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message)
        // Re-open if still unset after failure so the user can retry
        if (previous === undefined) {
          setIsOpen(true)
        }
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
