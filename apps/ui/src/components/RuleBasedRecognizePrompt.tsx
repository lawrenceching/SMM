import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { Loader2 } from "lucide-react"

export interface RuleBasedRecognizePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
  tvShowTitle: string
  tvShowTmdbId: number
  isLoading?: boolean
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
  ...promptProps
}: RuleBasedRecognizePromptProps) {
  const { t } = useTranslation('components')

  const message = t('toolbar.recognizePrompt', {
    tvShowTitle,
    tvShowTmdbId,
    defaultValue: 'Is it {{tvShowTitle}} ({{tvShowTmdbId}})?'
  })
  const loadingMessage = t('toolbar.recognizing', { defaultValue: 'Recognizing episodes…' })

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isConfirmButtonDisabled={isConfirmButtonDisabled ?? isLoading}
      isConfirmDisabled={isConfirmDisabled}
      mode="manual"
      className={cn(className)}
    >
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
    </FloatingPrompt>
  )
}
