import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useLayoutEffect, useRef, useState } from "react"

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
}

export function FloatingToolbar({
  options = [],
  selectedValue,
  onValueChange,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  placeholder = "Select...",
  className,
  isOpen = false,
  isConfirmDisabled = false,
  isConfirmButtonDisabled = false,
  mode = "manual",
}: FloatingToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{ left?: string; width?: string }>({})

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement
        if (parent) {
          const rect = parent.getBoundingClientRect()
          // Use the parent's full width (offsetWidth includes padding)
          const parentWidth = parent.offsetWidth
          setStyle({
            left: `${rect.left}px`,
            width: `${parentWidth}px`,
          })
        }
      }
    }

    updatePosition()
    
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <>
      <div ref={containerRef} className="absolute top-0 left-0 w-0 h-0 pointer-events-none" aria-hidden="true" />
      <div
        className={cn(
          "fixed top-0 z-50 flex items-center justify-between gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2 shadow-sm",
          "animate-in slide-in-from-top duration-300 fade-in-0",
          className
        )}
        style={style}
      >
        <div className="flex items-center gap-2">
          {mode === "manual" ? (
            <Select value={selectedValue} onValueChange={onValueChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={placeholder} />
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
              <div>
                AI is going to rename episodes, please review...
              </div>
            ) : null
          }
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isConfirmDisabled}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={isConfirmButtonDisabled}>{confirmLabel}</Button>
        </div>
      </div>
    </>
  )
}

