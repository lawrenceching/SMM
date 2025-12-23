import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ImmersiveInputProps extends React.ComponentProps<"input"> {
  className?: string
  onSearch?: () => void
  isOpen?: boolean
}

export function ImmersiveInput({ className, value, onChange, onSearch, isOpen, ...props }: ImmersiveInputProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Show focused appearance if input is focused OR dropdown is open
  const shouldShowFocused = isFocused || (isOpen ?? false)

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
    // If dropdown is open, don't update internal focus state
    if (isOpen) {
      props.onBlur?.(e)
      return
    }
    // Delay blur to allow button click
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsFocused(false)
      }
    }, 200)
    props.onBlur?.(e)
  }

  const handleSearchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Prevent blur from closing popover
    if ('stopImmediatePropagation' in e) {
      (e as unknown as { stopImmediatePropagation: () => void }).stopImmediatePropagation();
    }
    // Keep focus on input when search button is clicked
    // Use requestAnimationFrame to ensure focus happens after any blur events
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    onSearch?.()
  }

  const showSearchButton = shouldShowFocused && onSearch

  return (
    <div ref={containerRef} className="relative w-full">
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
          !shouldShowFocused && [
            "border-0 bg-transparent px-3 py-0 shadow-none",
            "text-foreground cursor-text",
            "hover:text-foreground/80",
          ],
          // Input-like styles when focused
          shouldShowFocused && [
            "file:text-foreground placeholder:text-muted-foreground",
            "selection:bg-primary selection:text-primary-foreground",
            "dark:bg-input/30 border-input h-9 rounded-md border bg-transparent px-3 py-1 shadow-xs",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            // Add right padding when search button is visible
            showSearchButton && "pr-10",
          ],
          className
        )}
      />
      {showSearchButton && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={handleSearchClick}
          onMouseDown={(e) => e.preventDefault()} // Prevent input blur
        >
          <Search className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}