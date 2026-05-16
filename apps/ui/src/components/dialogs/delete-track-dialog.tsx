import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

export interface DeleteTrackDialogProps {
  /** File path relative to the media folder when possible. */
  displayPath: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteTrackDialog({ displayPath, onConfirm, onCancel }: DeleteTrackDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("deleteTrack.message", { path: displayPath })}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("cancel", { ns: "common" })}
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          {t("delete", { ns: "common" })}
        </Button>
      </div>
    </div>
  )
}
