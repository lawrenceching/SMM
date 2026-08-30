import { useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

export interface AnonymousTelemetryConsentDialogProps {
  isOpen: boolean
  onAgree: () => void
  onDisagree: () => void
}

/**
 * First-run consent for anonymous usage information.
 * Dismiss (overlay / Esc / close) is treated as disagree.
 * Agree uses a ref guard so closing after agree does not also fire disagree.
 */
export function AnonymousTelemetryConsentDialog({
  isOpen,
  onAgree,
  onDisagree,
}: AnonymousTelemetryConsentDialogProps) {
  const { t } = useTranslation("components", {
    keyPrefix: "anonymousTelemetryConsent",
  })
  const decidedRef = useRef(false)

  const handleAgree = () => {
    decidedRef.current = true
    onAgree()
  }

  const handleDisagree = () => {
    decidedRef.current = true
    onDisagree()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !decidedRef.current) {
          onDisagree()
        }
        if (open) {
          decidedRef.current = false
        }
      }}
    >
      <DialogContent
        className="max-w-lg"
        data-testid="anonymous-telemetry-consent-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="anonymous-telemetry-consent-disagree"
            onClick={handleDisagree}
          >
            {t("disagree")}
          </Button>
          <Button
            type="button"
            data-testid="anonymous-telemetry-consent-agree"
            onClick={handleAgree}
          >
            {t("agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
