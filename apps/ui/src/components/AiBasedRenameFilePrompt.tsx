import { FloatingPrompt, type FloatingPromptProps } from "./FloatingPrompt"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface AiBasedRenameFilePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
  /**
   * Status of the AI renaming operation
   * - "generating": AI is generating output
   * - "wait-for-ack": Waiting for user to confirm
   */
  status: "generating" | "wait-for-ack"
}

/**
 * AiBasedRenameFilePrompt component built on top of FloatingPrompt.
 * Used to confirm AI renaming operations with status indicators.
 */
export function AiBasedRenameFilePrompt({
  status,
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  confirmLabel,
  cancelLabel,
  isConfirmButtonDisabled,
  isConfirmDisabled,
  ...promptProps
}: AiBasedRenameFilePromptProps) {
  const { t } = useTranslation('components')

  // Map status to FloatingPrompt's status prop
  const floatingPromptStatus = status === "generating" ? "running" : "wait-for-ack"

  // Determine if confirm button should be disabled
  const isConfirmButtonDisabledFinal = isConfirmButtonDisabled || status === "generating"
  const isConfirmDisabledFinal = isConfirmDisabled || status === "generating"

  // Get status message
  const statusMessage = status === "generating" 
    ? t('toolbar.aiGenerating', { defaultValue: 'AI is generating file names...' })
    : t('toolbar.aiReview', { defaultValue: 'Review AI-generated file names' })

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isConfirmButtonDisabled={isConfirmButtonDisabledFinal}
      isConfirmDisabled={isConfirmDisabledFinal}
      mode="ai"
      status={floatingPromptStatus}
      className={cn(className)}
    >
      <div className="flex items-center gap-2">
        {status === "generating" && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        <span className="text-sm">
          {statusMessage}
        </span>
      </div>
    </FloatingPrompt>
  )
}
