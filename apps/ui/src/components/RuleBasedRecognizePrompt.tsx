import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface RuleBasedRecognizePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
  tvShowTitle: string
  tvShowTmdbId: number
}

/**
 * RuleBasedRecognizePrompt component built on top of FloatingPrompt.
 * Used to review and confirm recognized episodes without status indicators.
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
  ...promptProps
}: RuleBasedRecognizePromptProps) {
  const { t } = useTranslation('components')

  const message = t('toolbar.recognizePrompt', {
    tvShowTitle,
    tvShowTmdbId,
    defaultValue: 'Is it {{tvShowTitle}} ({{tvShowTmdbId}})?'
  })

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isConfirmButtonDisabled={isConfirmButtonDisabled}
      isConfirmDisabled={isConfirmDisabled}
      mode="manual"
      className={cn(className)}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {message}
        </span>
      </div>
    </FloatingPrompt>
  )
}
