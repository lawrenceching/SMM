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

export const SMM_RELEASES_URL = "https://github.com/lawrenceching/fanclub/releases"

interface NewVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentVersion: string
  latestVersion: string
}

export function NewVersionDialog({
  open,
  onOpenChange,
  currentVersion,
  latestVersion,
}: NewVersionDialogProps) {
  const { t } = useTranslation("components")

  const handleDownload = () => {
    window.open(SMM_RELEASES_URL, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-version-dialog">
        <DialogHeader>
          <DialogTitle>{t("statusBar.versionUpdate.title")}</DialogTitle>
          <DialogDescription>
            {t("statusBar.versionUpdate.description", {
              current: currentVersion,
              latest: latestVersion,
            })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("statusBar.versionUpdate.currentLabel")}: {currentVersion}
          <br />
          {t("statusBar.versionUpdate.latestLabel")}: {latestVersion}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("statusBar.versionUpdate.later")}
          </Button>
          <Button onClick={handleDownload}>
            {t("statusBar.versionUpdate.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
