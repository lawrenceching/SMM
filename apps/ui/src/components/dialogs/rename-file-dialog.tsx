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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RenameFileDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"

export function RenameFileDialog({
  isOpen,
  onClose,
  onConfirm,
  initialValue = "",
  title,
  description,
  suggestions = [],
}: RenameFileDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const defaultTitle = title || t("rename.defaultTitle")
  const defaultDescription = description || t("rename.defaultDescription")
  const [newName, setNewName] = useState(initialValue)

  useEffect(() => {
    if (isOpen) {
      setNewName(initialValue)
    }
  }, [isOpen, initialValue])

  const handleConfirm = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed) return

    void onConfirm(trimmed)
    onClose()
  }, [newName, onClose, onConfirm])

  const handleCancel = useCallback(() => {
    setNewName(initialValue)
    onClose()
  }, [initialValue, onClose])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirm()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setNewName(suggestion)
  }

  const confirmDisabled =
    !newName.trim() ||
    newName.trim() === (initialValue || "").trim()

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
        className="max-w-md"
        data-testid="rename-dialog"
      >
        <ScrollableDialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="newName">{t("rename.newNameLabel")}</Label>
            <Input
              id="newName"
              type="text"
              placeholder={t("rename.placeholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              data-testid="rename-dialog-input"
            />
          </div>
          {suggestions && suggestions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{t("rename.suggestions")}</span>
              <div className="flex flex-wrap gap-1.5" data-testid="rename-dialog-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-left px-2 py-1 rounded text-xs border bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer whitespace-nowrap"
                    data-testid={`rename-dialog-suggestion-${index}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="rename-dialog-cancel"
          >
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            data-testid="rename-dialog-confirm"
          >
            {t("confirm", { ns: "common" })}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
