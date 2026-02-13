import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useEffect, useMemo } from "react"
import { RenameRules } from "@core/types"

interface RenameRuleComboboxProps {
  className?: string
  onRenameRuleChange?: (renameRuleName: string) => void
}

export function RenameRuleCombobox({ onRenameRuleChange }: RenameRuleComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const options: string[] = useMemo(() => {
    return Object.values(RenameRules).map((rule) => rule.name)
  }, [])

  useEffect(() => {
    if(value && value.trim().length > 0) {
      onRenameRuleChange?.(value)
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-[200px] justify-between"
    >
      {value && value.trim().length > 0 ? value : "选择重命名规则..."}
      <ChevronsUpDown className="opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[200px] p-0">
    <Command>
      <CommandInput placeholder="Search framework..." className="h-9" />
      <CommandList>
        <CommandEmpty>No framework found.</CommandEmpty>
        <CommandGroup>
          {options.map((renameRuleName) => (
            <CommandItem
              key={renameRuleName}
              value={renameRuleName}
              onSelect={(currentValue) => {
                setValue(currentValue === value ? "" : currentValue)
                setOpen(false)
              }}
            >
              {renameRuleName}
              <Check
                className={cn(
                  "ml-auto",
                  value === renameRuleName ? "opacity-100" : "opacity-0"
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
    </Popover>
  )
}
