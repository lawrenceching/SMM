import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface UseNfoPromptProps extends Omit<FloatingPromptProps, 'mode' | 'children' | 'options' | 'selectedValue' | 'onValueChange' | 'confirmLabel' | 'cancelLabel' | 'isConfirmButtonDisabled' | 'isConfirmDisabled'> {
  /**
   * Callback when the user confirms to use NFO metadata
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
}

/**
 * UseNfoPrompt component built on top of FloatingPrompt.
 * Asks the user to confirm whether to use media metadata from an NFO file.
 */
export function UseNfoPrompt({
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  ...promptProps
}: UseNfoPromptProps) {
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
      <span>{t('toolbar.useNfoMetadata')}</span>
    </FloatingPrompt>
  )
}
