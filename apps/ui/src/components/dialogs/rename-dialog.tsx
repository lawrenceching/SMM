import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RenameDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"
import { basename } from "@/lib/path"
import type { MediaMetadata } from "@core/types"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { useRenameMediaFolderMutation } from "@/hooks/useRenameMediaFolderMutation"
import { Loader2 } from "lucide-react"

function buildTvShowFolderRenameSuggestions(metadata: MediaMetadata): string[] {
  const suggestions: string[] = []
  const tvShow = metadata.tvShow
  if (tvShow && tvShow.airDate !== undefined) {
    try {
      const year = tvShow.airDate.split("-")[0]
      const idKey = tvShow.database === "TVDB" ? "tvdbid" : "tmdbid"
      const suggestion = `${tvShow.name}${year ? ` (${year})` : ""} {${idKey}=${tvShow.id}}`
      suggestions.push(suggestion)
    } catch (error) {
      console.warn(`[RenameDialog] Failed to get year from air date: ${tvShow.airDate}`, error)
    }
  }
  return suggestions
}

function buildMovieFolderRenameSuggestions(metadata: MediaMetadata): string[] {
  const suggestions: string[] = []
  const movie = metadata.movie
  if (movie && movie.airDate !== undefined) {
    try {
      const year = movie.airDate.split("-")[0]
      const idKey = movie.database === "TVDB" ? "tvdbid" : "tmdbid"
      const suggestion = `${movie.name}${year ? ` (${year})` : ""} {${idKey}=${movie.id}}`
      suggestions.push(suggestion)
    } catch (error) {
      console.warn(`[RenameDialog] Failed to get year from air date: ${movie.airDate}`, error)
    }
  }
  return suggestions
}

export function RenameDialog({
  isOpen,
  onClose,
  onConfirm,
  initialValue = "",
  title,
  description,
  suggestions = [],
  mediaFolderPath,
}: RenameDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const defaultTitle = title || t("rename.defaultTitle")
  const defaultDescription = description || t("rename.defaultDescription")

  const { mutateAsync: renameMediaFolderAsync, reset: resetRenameFolderMutation, isPending: isRenameFolderPending } =
    useRenameMediaFolderMutation()

  const metadataQuery = useMediaMetadataQuery(mediaFolderPath || undefined)

  /** Folder rename: initial text is the on-disk folder name (basename), not tvShow/movie display titles. */
  const effectiveInitialValue = useMemo(() => {
    if (mediaFolderPath) {
      return basename(mediaFolderPath) ?? ""
    }
    return initialValue ?? ""
  }, [mediaFolderPath, initialValue])

  const effectiveSuggestions = useMemo(() => {
    if (mediaFolderPath) {
      const data = metadataQuery.data
      if (!data) return []
      return [
        ...buildTvShowFolderRenameSuggestions(data),
        ...buildMovieFolderRenameSuggestions(data),
      ]
    }
    return suggestions
  }, [mediaFolderPath, metadataQuery.data, suggestions])

  const [newName, setNewName] = useState(effectiveInitialValue)

  const isMutating = Boolean(mediaFolderPath && isRenameFolderPending)

  // Reset when dialog opens or effective initial value changes
  useEffect(() => {
    if (isOpen) {
      setNewName(effectiveInitialValue)
    }
  }, [isOpen, effectiveInitialValue])

  useEffect(() => {
    if (!isOpen) {
      resetRenameFolderMutation()
    }
  }, [isOpen, resetRenameFolderMutation])

  const handleConfirm = useCallback(async () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    if (mediaFolderPath) {
      try {
        await renameMediaFolderAsync({ mediaFolderPath, newName: trimmed })
        onClose()
      } catch (error) {
        console.error("[RenameDialog] renameMediaFolderAsync failed:", error)
      }
      return
    }

    void onConfirm(trimmed)
    onClose()
  }, [newName, mediaFolderPath, onConfirm, onClose, renameMediaFolderAsync])

  const handleCancel = useCallback(() => {
    if (isMutating) return
    setNewName(effectiveInitialValue)
    onClose()
  }, [effectiveInitialValue, isMutating, onClose])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isMutating) return
    if (e.key === "Enter") {
      void handleConfirm()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    if (isMutating) return
    setNewName(suggestion)
  }

  const confirmDisabled =
    isMutating ||
    !newName.trim() ||
    newName.trim() === (effectiveInitialValue || "").trim()

  const blockDismiss = isMutating

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !blockDismiss) {
          handleCancel()
        }
      }}
    >
      <DialogContent
        showCloseButton={!blockDismiss}
        className="max-w-md"
        data-testid="rename-dialog"
        onInteractOutside={(e) => {
          if (blockDismiss) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (blockDismiss) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </DialogHeader>
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
              disabled={isMutating}
              data-testid="rename-dialog-input"
            />
          </div>
          {effectiveSuggestions && effectiveSuggestions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{t("rename.suggestions")}</span>
              <div className="flex flex-wrap gap-1.5" data-testid="rename-dialog-suggestions">
                {effectiveSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-left px-2 py-1 rounded text-xs border bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
                    data-testid={`rename-dialog-suggestion-${index}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isMutating}
            data-testid="rename-dialog-cancel"
          >
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            className={isMutating ? "inline-flex items-center gap-2" : undefined}
            onClick={() => void handleConfirm()}
            disabled={confirmDisabled}
            data-testid="rename-dialog-confirm"
          >
            {isMutating ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                {t("confirm", { ns: "common" })}
              </>
            ) : (
              t("confirm", { ns: "common" })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
