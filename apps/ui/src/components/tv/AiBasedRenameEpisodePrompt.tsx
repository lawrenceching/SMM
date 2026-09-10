import { FloatingPrompt, type FloatingPromptProps } from "../FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export type AiBasedRenameEpisodePromptProps = Omit<FloatingPromptProps, 'mode' | 'status' | 'children'>

/**
 * AiBasedRenameEpisodePrompt component built on top of FloatingPrompt.
 * Used to confirm AI episode renaming operations.
 */
export function AiBasedRenameEpisodePrompt({
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  confirmLabel,
  cancelLabel,
  isConfirmButtonDisabled,
  isConfirmDisabled,
  ...promptProps
}: AiBasedRenameEpisodePromptProps) {
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
      <div className="flex items-center gap-2" data-testid="ai-based-rename-status">
        <span className="text-sm">
          {t('toolbar.aiReview', { defaultValue: 'Review AI-generated file names' })}
        </span>
      </div>
    </FloatingPrompt>
  )
}
