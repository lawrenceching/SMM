import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TextDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"

export function TextDialog({
  isOpen,
  onClose,
  onConfirm,
  initialValue = "",
  title,
  description,
  label,
}: TextDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const defaultTitle = title ?? t("textDialog.defaultTitle")
  const defaultDescription = description ?? t("textDialog.defaultDescription")
  const [text, setText] = useState(initialValue)

  useEffect(() => {
    if (isOpen) {
      setText(initialValue)
    }
  }, [isOpen, initialValue])

  const handleConfirm = useCallback(() => {
    onConfirm(text)
    onClose()
  }, [onClose, onConfirm, text])

  const handleCancel = useCallback(() => {
    setText(initialValue)
    onClose()
  }, [initialValue, onClose])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel()
        }
      }}
    >
      <ScrollableDialogContent
        className="max-w-lg"
        data-testid="text-dialog"
      >
        <ScrollableDialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
          <div className="flex flex-col gap-2 py-4">
            {label ? <Label htmlFor="text-dialog-input">{label}</Label> : null}
            <Textarea
              id="text-dialog-input"
              data-testid="text-dialog-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-xs min-h-[200px]"
              autoFocus
            />
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="text-dialog-cancel"
          >
            {t("cancel", { ns: "common" })}
          </Button>
          <Button onClick={handleConfirm} data-testid="text-dialog-confirm">
            {t("confirm", { ns: "common" })}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
