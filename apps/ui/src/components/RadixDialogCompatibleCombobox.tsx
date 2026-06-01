"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface RadixDialogCompatibleComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  /** Merge options with current value when not in the list. */
  mergeCustomValue?: boolean
  placeholder?: string
  id?: string
  "data-testid"?: string
  invalid?: boolean
  emptyLabel?: string
  className?: string
}

function mergeOptions(options: string[], currentValue?: string): string[] {
  const items = [...options]
  const custom = (currentValue ?? "").trim()
  if (custom && !items.includes(custom)) {
    items.unshift(custom)
  }
  return items
}

/**
 * Creatable string combobox built on Radix Popover (modal={false}) so it works
 * inside Radix Dialog. Pattern aligned with {@link ImmersiveSearchbox}.
 */
export function RadixDialogCompatibleCombobox({
  value,
  onValueChange,
  options,
  mergeCustomValue = true,
  placeholder,
  id,
  "data-testid": dataTestId,
  invalid,
  emptyLabel = "No matches",
  className,
}: RadixDialogCompatibleComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(
    undefined,
  )
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  React.useEffect(() => {
    if (open && anchorRef.current) {
      setPopoverWidth(anchorRef.current.offsetWidth)
    }
  }, [open])

  const items = React.useMemo(() => {
    if (!mergeCustomValue) return [...options]
    return mergeOptions(options, inputValue)
  }, [options, inputValue, mergeCustomValue])

  const commitInputValue = React.useCallback(
    (next: string) => {
      const trimmed = next.trim()
      setInputValue(trimmed)
      if (trimmed !== value.trim()) {
        onValueChange(trimmed)
      }
    },
    [onValueChange, value],
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        commitInputValue(inputValue)
      }
      setOpen(nextOpen)
    },
    [commitInputValue, inputValue],
  )

  const handleSelectOption = React.useCallback(
    (option: string) => {
      setInputValue(option)
      commitInputValue(option)
      setOpen(false)
    },
    [commitInputValue],
  )

  const openList = React.useCallback(() => {
    setOpen(true)
  }, [])

  const toggleList = React.useCallback(() => {
    handleOpenChange(!open)
  }, [handleOpenChange, open])

  const handleAnchorClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-slot="combobox-toggle"]')) return
      const input = anchorRef.current?.querySelector("input")
      if (!input) return
      if (target !== input) {
        input.focus()
      }
      openList()
    },
    [openList],
  )

  /** Dialog scroll steals wheel while focus stays on the input; scroll the list locally. */
  const handleListWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const list = listRef.current
    if (!list) return

    const { scrollTop, scrollHeight, clientHeight } = list
    const maxScroll = scrollHeight - clientHeight
    if (maxScroll <= 0) return

    const nextScrollTop = Math.min(maxScroll, Math.max(0, scrollTop + e.deltaY))
    if (nextScrollTop !== scrollTop) {
      list.scrollTop = nextScrollTop
      e.preventDefault()
    }
  }, [])

  return (
    <div className={cn("w-full min-w-0", className)}>
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            className="relative w-full min-w-0 cursor-text"
            onClick={handleAnchorClick}
          >
            <Input
              id={id}
              data-testid={dataTestId}
              role="combobox"
              aria-expanded={open}
              aria-invalid={invalid || undefined}
              aria-autocomplete="list"
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={openList}
              onClick={openList}
              className={cn("w-full pr-9", invalid && "border-destructive")}
            />
            <button
              type="button"
              tabIndex={-1}
              data-slot="combobox-toggle"
              aria-label="Toggle options"
              aria-expanded={open}
              className="absolute top-0 right-0 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation()
                toggleList()
              }}
            >
              <ChevronDownIcon
                aria-hidden
                className={cn("size-4 transition-transform", open && "rotate-180")}
              />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) max-w-none overflow-hidden p-0"
          align="start"
          side="bottom"
          sideOffset={6}
          style={{ width: popoverWidth ? `${popoverWidth}px` : undefined }}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            anchorRef.current?.querySelector<HTMLInputElement>("input")?.focus()
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement
            if (anchorRef.current?.contains(target)) {
              e.preventDefault()
            }
          }}
          onWheel={handleListWheel}
        >
          <div
            ref={listRef}
            role="listbox"
            className="max-h-96 overflow-y-auto overflow-x-hidden overscroll-contain p-1"
            onWheel={handleListWheel}
          >
            {items.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={item === value.trim()}
                  className={cn(
                    "flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-2 text-left text-sm outline-hidden select-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    item === value.trim() && "bg-accent/50",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectOption(item)}
                >
                  {item}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
