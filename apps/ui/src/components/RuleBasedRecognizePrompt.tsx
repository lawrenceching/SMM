import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface RuleBasedRecognizePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
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
  ...promptProps
}: RuleBasedRecognizePromptProps) {
  const { t } = useTranslation('components')

  // Get message for review and confirm
  const message = t('toolbar.reviewRecognizeEpisodes', { 
    defaultValue: 'Review and confirm the recognize episodes...' 
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
