import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ArrowUpDown } from "lucide-react"
import type { SortingOption } from "./FilterButton"

export interface SortingButtonProps<T extends string> {
  value: T;
  options: SortingOption[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  tooltipLabel?: string;
  className?: string;
  triggerClassName?: string;
}

export function SortingButton<T extends string>({
  value,
  options,
  onValueChange,
  placeholder = "Sort",
  tooltipLabel,
  className,
  triggerClassName,
}: SortingButtonProps<T>) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
              size="sm"
              className={cn(
                "h-8 w-8 p-0 justify-center",
                "[&>svg:last-child]:hidden",
                triggerClassName
              )}
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="sr-only">{placeholder}</span>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipLabel || placeholder}: {options.find(o => o.value === value)?.label || value}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
