import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveInput } from "./ImmersiveInput"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getTMDBImageUrl } from "@/api/tmdb"
import type { TMDBTVShow } from "@core/types"

// Helper function to format date
function formatDate(dateString: string): string {
    if (!dateString) return "N/A"
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    } catch {
        return dateString
    }
}

interface ImmersiveSearchboxProps {
    value: string
    onChange: (value: string) => void
    onSearch: () => void
    onSelect: (result: TMDBTVShow) => void
    searchResults: TMDBTVShow[]
    isSearching: boolean
    searchError: string | null
    className?: string
    placeholder?: string
    inputClassName?: string
}

export function ImmersiveSearchbox({
    value,
    onChange,
    onSearch,
    onSelect,
    searchResults,
    isSearching,
    searchError,
    className,
    placeholder = "Enter TV show name",
    inputClassName,
}: ImmersiveSearchboxProps) {
    const [isSearchOpen, setIsSearchOpen] = React.useState(false)
    const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined)
    const inputContainerRef = React.useRef<HTMLDivElement>(null)

    // Measure input width when popover opens
    React.useEffect(() => {
        if (isSearchOpen && inputContainerRef.current) {
            const width = inputContainerRef.current.offsetWidth
            setPopoverWidth(width)
        }
    }, [isSearchOpen])

    const handleSearchButtonClick = React.useCallback(() => {
        const wasOpen = isSearchOpen
        if (!wasOpen) {
            setIsSearchOpen(true)
        }
        
        // Keep input focused
        setTimeout(() => {
            inputContainerRef.current?.querySelector('input')?.focus()
        }, 0)
        
        onSearch()
    }, [isSearchOpen, onSearch])

    const handleSelectResult = React.useCallback((result: TMDBTVShow) => {
        setIsSearchOpen(false)
        onSelect(result)
    }, [onSelect])

    return (
        <div className={cn("w-full", className)}>
            <Popover 
                open={isSearchOpen} 
                onOpenChange={setIsSearchOpen}
                modal={false}
            >
                <PopoverAnchor asChild>
                    <div ref={inputContainerRef}>
                        <ImmersiveInput 
                            value={value} 
                            onChange={(e) => onChange(e.target.value)}
                            onSearch={handleSearchButtonClick}
                            isOpen={isSearchOpen}
                            className={inputClassName}
                            placeholder={placeholder}
                        />
                    </div>
                </PopoverAnchor>
                <PopoverContent 
                    className="p-0" 
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    style={{ width: popoverWidth ? `${popoverWidth}px` : undefined }}
                    onInteractOutside={(e) => {
                        // Prevent closing when clicking the search button
                        const target = e.target as HTMLElement
                        if (inputContainerRef.current?.contains(target)) {
                            e.preventDefault()
                        }
                    }}
                >
                    <ScrollArea className="max-h-[400px]">
                        <div className="p-2">
                            {isSearching ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="text-muted-foreground">Searching...</div>
                                </div>
                            ) : searchError ? (
                                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                                    {searchError}
                                </div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map((result) => {
                                    const resultPosterUrl = getTMDBImageUrl(result.poster_path, "w200")
                                    return (
                                        <div
                                            key={result.id}
                                            onClick={() => handleSelectResult(result)}
                                            className="flex gap-3 p-3 rounded-md cursor-pointer hover:bg-accent transition-colors"
                                        >
                                            {resultPosterUrl && (
                                                <div className="shrink-0">
                                                    <img
                                                        src={resultPosterUrl}
                                                        alt={result.name}
                                                        className="w-16 h-24 object-cover rounded-md bg-muted"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement
                                                            target.style.display = "none"
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0" data-testid="tmdb-search-result-item">
                                                <h3 className="font-semibold text-base mb-1">
                                                    {result.name}
                                                </h3>
                                                {result.original_name !== result.name && (
                                                    <p className="text-sm text-muted-foreground mb-1">
                                                        {result.original_name}
                                                    </p>
                                                )}
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                    {result.overview || 'No overview available'}
                                                </p>
                                                {(result.first_air_date || result.vote_average) && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        {result.first_air_date && (
                                                            <span>{formatDate(result.first_air_date)}</span>
                                                        )}
                                                        {result.first_air_date && result.vote_average && (
                                                            <span>•</span>
                                                        )}
                                                        {result.vote_average > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                                                {result.vote_average.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="flex items-center justify-center h-32 text-muted-foreground">
                                    {value.trim() ? 'No results found' : 'Enter a search query and click search'}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
        </div>
    )
}
