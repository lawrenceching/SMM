import { FloatingPrompt, type FloatingPromptProps } from "../FloatingPrompt"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { Info, Loader2 } from "lucide-react"

export interface RuleBasedRecognizePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
  tvShowTitle?: string
  tvShowTmdbId?: number
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
  const ruleBasedRecognizeHintMessage = t('toolbar.ruleBasedRecognizeHint', {
    defaultValue:
      'This recognition is based on an internally maintained rule set and cannot reliably recognize all files. We recommend using AI.',
  })
  const allPlanFilesUnchangedMessage = t('toolbar.allPlanFilesUnchanged', {
    defaultValue: 'Nothing to apply.',
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
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm text-muted-foreground"
              data-testid="rule-based-recognize-not-all-message"
            >
              {notAllEpisodesMessage}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={ruleBasedRecognizeHintMessage}
                  data-testid="rule-based-recognize-hint-icon"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-xs text-pretty"
                data-testid="rule-based-recognize-hint-tooltip"
              >
                {ruleBasedRecognizeHintMessage}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        {!isLoading && allPlanFilesUnchanged && (
          <span className="text-sm text-muted-foreground">{allPlanFilesUnchangedMessage}</span>
        )}
      </div>
    </FloatingPrompt>
  )
}
