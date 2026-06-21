import { FloatingPrompt, type FloatingPromptProps } from "../FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { Loader2 } from "lucide-react"

export interface RuleBasedRecognizePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
  tvShowTitle: string
  tvShowTmdbId: number
  isLoading?: boolean
  notAllEpisodesRecognized?: boolean
  allPlanFilesUnchanged?: boolean
}

/**
 * RuleBasedRecognizePrompt component built on top of FloatingPrompt.
 * Used to review and confirm recognized episodes. Shows loading state while recognition runs.
 */
export function RuleBasedRecognizePrompt({
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  confirmLabel,
  cancelLabel,
  isConfirmButtonDisabled,
  isConfirmDisabled,
  tvShowTitle,
  tvShowTmdbId,
  isLoading = false,
  notAllEpisodesRecognized = false,
  allPlanFilesUnchanged = false,
  ...promptProps
}: RuleBasedRecognizePromptProps) {
  const { t } = useTranslation('components')

  const message = t('toolbar.recognizeReviewPrompt', {
    defaultValue: 'Please review',
  })
  const loadingMessage = t('toolbar.recognizing', { defaultValue: 'Recognizing episodes…' })
  const notAllEpisodesMessage = t('toolbar.notAllEpisodesRecognized', {
    defaultValue: 'It seems not all episodes are recognized',
  })
  const allPlanFilesUnchangedMessage = t('toolbar.allPlanFilesUnchanged', {
    defaultValue: 'All episodes already match the current video file mappings. There is nothing to apply.',
  })

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isConfirmButtonDisabled={(isConfirmButtonDisabled ?? isLoading) || allPlanFilesUnchanged}
      isConfirmDisabled={isConfirmDisabled}
      mode="manual"
      className={cn(className)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="text-sm">{loadingMessage}</span>
            </>
          ) : (
            <span className="text-sm">{message}</span>
          )}
        </div>
        {!isLoading && notAllEpisodesRecognized && (
          <span className="text-sm text-muted-foreground">{notAllEpisodesMessage}</span>
        )}
        {!isLoading && allPlanFilesUnchanged && (
          <span className="text-sm text-muted-foreground">{allPlanFilesUnchangedMessage}</span>
        )}
      </div>
    </FloatingPrompt>
  )
}
