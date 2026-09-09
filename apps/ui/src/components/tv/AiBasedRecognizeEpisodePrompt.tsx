import { FloatingPrompt, type FloatingPromptProps } from "../FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export type AiBasedRecognizeEpisodePromptProps = Omit<FloatingPromptProps, 'mode' | 'status' | 'children'>

/**
 * AiBasedRecognizeEpisodePrompt component built on top of FloatingPrompt.
 * Used to confirm AI episode recognition operations.
 */
export function AiBasedRecognizeEpisodePrompt({
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  confirmLabel,
  cancelLabel,
  isConfirmButtonDisabled,
  isConfirmDisabled,
  ...promptProps
}: AiBasedRecognizeEpisodePromptProps) {
  const { t } = useTranslation('components')

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
      mode="ai"
      className={cn(className)}
    >
      <div className="flex items-center gap-2" data-testid="ai-based-recognize-status">
        <span className="text-sm">
          {t('toolbar.aiReviewEpisodes', { defaultValue: 'Review recognized episodes' })}
        </span>
      </div>
    </FloatingPrompt>
  )
}
