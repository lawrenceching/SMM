import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export interface FloatingToolbarOption {
  value: string
  label: string
}

export interface FloatingToolbarProps {
  options?: FloatingToolbarOption[]
  selectedValue?: string
  onValueChange?: (value: string) => void
  onConfirm?: () => void
  onCancel?: () => void
  confirmLabel?: string
  cancelLabel?: string
  placeholder?: string
  className?: string
  isOpen?: boolean
  isConfirmDisabled?: boolean
  isConfirmButtonDisabled?: boolean
  mode: "manual" | "ai"
  status?: "running" | "wait-for-ack"
}

export function FloatingToolbar({
  options = [],
  selectedValue,
  onValueChange,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  placeholder,
  className,
  isOpen = false,
  isConfirmDisabled = false,
  isConfirmButtonDisabled = false,
  mode = "manual",
  status,
}: FloatingToolbarProps) {
  const { t } = useTranslation('components')
  const defaultConfirmLabel = confirmLabel ?? t('toolbar.confirm')
  const defaultCancelLabel = cancelLabel ?? t('toolbar.cancel')
  const defaultPlaceholder = placeholder ?? t('toolbar.selectPlaceholder')
  
  if (!isOpen) {
    return null
  }

  const showAnimatedShadow = mode === "ai" && status === "running"

  return (
    <>
      <style>{`
        @keyframes flowing-shadow {
          0% {
            box-shadow: 
              0 3px 12px rgba(59, 130, 246, 0.6),
              0 6px 20px rgba(139, 92, 246, 0.5),
              0 9px 30px rgba(236, 72, 153, 0.4),
              0 12px 40px rgba(59, 130, 246, 0.25);
          }
          25% {
            box-shadow: 
              0 3px 12px rgba(139, 92, 246, 0.6),
              0 6px 20px rgba(236, 72, 153, 0.5),
              0 9px 30px rgba(245, 158, 11, 0.4),
              0 12px 40px rgba(139, 92, 246, 0.25);
          }
          50% {
            box-shadow: 
              0 3px 12px rgba(236, 72, 153, 0.6),
              0 6px 20px rgba(245, 158, 11, 0.5),
              0 9px 30px rgba(16, 185, 129, 0.4),
              0 12px 40px rgba(236, 72, 153, 0.25);
          }
          75% {
            box-shadow: 
              0 3px 12px rgba(245, 158, 11, 0.6),
              0 6px 20px rgba(16, 185, 129, 0.5),
              0 9px 30px rgba(59, 130, 246, 0.4),
              0 12px 40px rgba(245, 158, 11, 0.25);
          }
          100% {
            box-shadow: 
              0 3px 12px rgba(59, 130, 246, 0.6),
              0 6px 20px rgba(139, 92, 246, 0.5),
              0 9px 30px rgba(236, 72, 153, 0.4),
              0 12px 40px rgba(59, 130, 246, 0.25);
          }
        }
        .floating-toolbar-with-shadow {
          animation: flowing-shadow 4s ease-in-out infinite;
        }
      `}</style>
      <div
        className={cn(
          "z-50 flex items-center justify-between gap-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b px-4 py-2 shadow-sm",
          "animate-in slide-in-from-top duration-300 fade-in-0",
          showAnimatedShadow && "relative floating-toolbar-with-shadow",
          className
        )}
      >
        <div className="flex items-center gap-2">
          {mode === "manual" ? (
            <Select value={selectedValue} onValueChange={onValueChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={defaultPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {
            mode === "ai" ? (
              <div className="flex items-center gap-2">
                {status === "running" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span>
                  {status === "running"
                    ? t('toolbar.aiRenaming')
                    : t('toolbar.aiReview')}
                </span>
              </div>
            ) : null
          }
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isConfirmDisabled}>
            {defaultCancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isConfirmButtonDisabled}
            className={cn(
              mode === "ai" &&
                status === "wait-for-ack" &&
                "animate-pulse ring-2 ring-primary/50 ring-offset-2"
            )}
          >
            {defaultConfirmLabel}
          </Button>
        </div>
      </div>

    </>
  )
}

