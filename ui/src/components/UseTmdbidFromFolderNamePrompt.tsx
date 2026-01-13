import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
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
  ...promptProps
}: UseTmdbidFromFolderNamePromptProps) {
  const { t } = useTranslation('components')

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      mode="manual"
      className={cn(className)}
    >
      <div className="flex flex-col">
        <span>{t('toolbar.useTmdbIdFromFolderName')}</span>
        {(mediaName || tmdbid !== undefined) && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {mediaName && <span>{mediaName}</span>}
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
