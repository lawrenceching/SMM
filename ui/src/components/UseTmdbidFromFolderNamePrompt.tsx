import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface UseTmdbidFromFolderNamePromptProps extends Omit<FloatingPromptProps, 'mode' | 'children' | 'options' | 'selectedValue' | 'onValueChange' | 'confirmLabel' | 'cancelLabel' | 'isConfirmButtonDisabled' | 'isConfirmDisabled'> {
  /**
   * Callback when the user confirms to use TMDB ID from folder name
   */
  onConfirm?: () => void
  /**
   * Callback when the user cancels
   */
  onCancel?: () => void
  /**
   * Whether the prompt is open
   */
  isOpen?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Media name from TMDB
   */
  mediaName?: string
  /**
   * TMDB ID extracted from folder name
   */
  tmdbid?: number
  /**
   * Status of the TMDB query
   * - "ready": Query completed successfully, ready to confirm
   * - "loading": Querying TMDB
   * - "error": Query failed
   */
  status?: "ready" | "loading" | "error"
}

/**
 * UseTmdbidFromFolderNamePrompt component built on top of FloatingPrompt.
 * Asks the user to confirm whether to use TMDB ID extracted from folder name.
 */
export function UseTmdbidFromFolderNamePrompt({
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  mediaName,
  tmdbid,
  status = "ready",
  ...promptProps
}: UseTmdbidFromFolderNamePromptProps) {
  const { t } = useTranslation('components')

  // Determine if confirm button should be disabled
  const isConfirmButtonDisabled = status === "loading" || status === "error"

  // Get display text based on status
  let displayText: string | undefined = mediaName
  if (status === "loading") {
    displayText = t('toolbar.queryingTmdb')
  } else if (status === "error") {
    displayText = t('toolbar.queryTmdbFailed')
  }

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      mode="manual"
      isConfirmButtonDisabled={isConfirmButtonDisabled}
      className={cn(className)}
    >
      <div className="flex flex-col">
        <span>{t('toolbar.useTmdbIdFromFolderName')}</span>
        {(displayText || tmdbid !== undefined) && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {status === "loading" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {displayText && <span>{displayText}</span>}
            {tmdbid !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help underline decoration-dotted">
                    {tmdbid}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>TMDB ID</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </FloatingPrompt>
  )
}
