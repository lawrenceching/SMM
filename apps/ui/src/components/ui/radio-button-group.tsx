import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface RadioButtonGroupOption<T extends string = string> {
  /** Option identifier, passed to `onSelect` when selected. */
  value: T
  /** Display text (used as button title / sr-only label). */
  label: string
  icon?: LucideIcon
}

export interface RadioButtonGroupProps<T extends string = string> {
  options: RadioButtonGroupOption<T>[]
  /** Currently selected option value. */
  value: T
  /** Called with the selected option's value. */
  onSelect: (value: T) => void
  disabled?: boolean
}

/** Generic segmented button group with radio semantics (single selection). */
export function RadioButtonGroup<T extends string>({
  options,
  value,
  onSelect,
  disabled,
}: RadioButtonGroupProps<T>) {
  const lastIndex = options.length - 1

  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background shadow-xs">
      {options.map((option, index) => {
        const Icon = option.icon
        const isFirst = index === 0
        const isLast = index === lastIndex
        const isSelected = value === option.value

        return (
          <Fragment key={option.value}>
            {index > 0 && <div className="h-4 w-px bg-border" />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSelect(option.value)}
              disabled={disabled}
              className={cn(
                "h-8 w-8 rounded-none transition-all",
                isFirst && "rounded-l-md",
                isLast && "rounded-r-md",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
              title={option.label}
              aria-pressed={isSelected}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="sr-only">{option.label}</span>
            </Button>
          </Fragment>
        )
      })}
    </div>
  )
}
