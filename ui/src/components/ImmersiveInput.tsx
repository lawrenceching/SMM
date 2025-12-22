import * as React from "react"
import { cn } from "@/lib/utils"

interface ImmersiveInputProps extends React.ComponentProps<"input"> {
  className?: string
}

export function ImmersiveInput({ className, value, onChange, ...props }: ImmersiveInputProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // If value is provided without onChange, use defaultValue for uncontrolled mode
  const isControlled = value !== undefined && onChange !== undefined
  const inputProps = isControlled
    ? { value, onChange }
    : value !== undefined
    ? { defaultValue: value }
    : {}

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    props.onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    props.onBlur?.(e)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      {...props}
      {...inputProps}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(
        // Base styles - always applied
        "w-full min-w-0 outline-none transition-all",
        // Label-like styles when not focused
        !isFocused && [
          "border-0 bg-transparent px-3 py-0 shadow-none",
          "text-foreground cursor-text",
          "hover:text-foreground/80",
        ],
        // Input-like styles when focused
        isFocused && [
          "file:text-foreground placeholder:text-muted-foreground",
          "selection:bg-primary selection:text-primary-foreground",
          "dark:bg-input/30 border-input h-9 rounded-md border bg-transparent px-3 py-1 shadow-xs",
          "text-base md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        ],
        className
      )}
    />
  )
}