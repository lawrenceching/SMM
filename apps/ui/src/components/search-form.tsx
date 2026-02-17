import { Search } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"

interface SearchFormProps extends React.ComponentProps<"form"> {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  testId?: string
}

export function SearchForm({
  value,
  onValueChange,
  placeholder = "Search media folders...",
  testId = "sidebar-search-input",
  ...props
}: SearchFormProps) {
  return (
    <form {...props}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <SidebarInput
            id="search"
            data-testid={testId}
            placeholder={placeholder}
            className="pl-8"
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
          />
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}
