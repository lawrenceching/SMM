import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveInput } from "./ImmersiveInput"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { getTMDBImageUrl } from "@/api/tmdb"
import type { TMDBTVShow, TMDBMovie } from "@core/types"

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
    onSelect: (result: TMDBTVShow | TMDBMovie) => void
    searchResults: (TMDBTVShow | TMDBMovie)[]
    isSearching: boolean
    searchError: string | null
    className?: string
    placeholder?: string
    inputClassName?: string
    /** When set, a Hover Card with this hint is always shown (not triggered by hover). */
    unrecognizedHint?: string
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
    unrecognizedHint,
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

    const handleSelectResult = React.useCallback((result: TMDBTVShow | TMDBMovie) => {
        setIsSearchOpen(false)
        onSelect(result)
    }, [onSelect])

    const getResultDisplayName = (result: TMDBTVShow | TMDBMovie) => ('name' in result ? result.name : result.title)
    const getResultOriginalName = (result: TMDBTVShow | TMDBMovie) => ('original_name' in result ? result.original_name : result.original_title)
    const getResultDate = (result: TMDBTVShow | TMDBMovie) => ('first_air_date' in result ? result.first_air_date : result.release_date)

    return (
        <div className={cn("w-full min-w-0", className)}>
            <Popover 
                open={isSearchOpen} 
                onOpenChange={setIsSearchOpen}
                modal={false}
            >
                <PopoverAnchor asChild>
                    <div ref={inputContainerRef} className="w-full min-w-0">
                        {unrecognizedHint ? (
                            // onOpenChange no-op keeps the card always open (hint is persistent when folder unrecognized)
                            <HoverCard open openDelay={0} onOpenChange={() => {}}>
                                <HoverCardTrigger asChild>
                                    <div className="w-full min-w-0">
                                        <ImmersiveInput
                                            value={value}
                                            onChange={(e) => onChange(e.target.value)}
                                            onSearch={handleSearchButtonClick}
                                            isOpen={isSearchOpen}
                                            className={inputClassName}
                                            placeholder={placeholder}
                                        />
                                    </div>
                                </HoverCardTrigger>
                                <HoverCardContent side="bottom" align="start" className="w-auto max-w-sm">
                                    {unrecognizedHint}
                                </HoverCardContent>
                            </HoverCard>
                        ) : (
                            <ImmersiveInput
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                onSearch={handleSearchButtonClick}
                                isOpen={isSearchOpen}
                                className={inputClassName}
                                placeholder={placeholder}
                            />
                        )}
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
                                    const displayName = getResultDisplayName(result)
                                    const originalName = getResultOriginalName(result)
                                    const dateStr = getResultDate(result)
                                    const voteAvg = result.vote_average ?? 0
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
                                                        alt={displayName}
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
                                                    {displayName}
                                                </h3>
                                                {originalName !== displayName && (
                                                    <p className="text-sm text-muted-foreground mb-1">
                                                        {originalName}
                                                    </p>
                                                )}
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                    {result.overview || 'No overview available'}
                                                </p>
                                                {(dateStr || voteAvg > 0) && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        {dateStr && (
                                                            <span>{formatDate(dateStr)}</span>
                                                        )}
                                                        {dateStr && voteAvg > 0 && (
                                                            <span>•</span>
                                                        )}
                                                        {voteAvg > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                                                {voteAvg.toFixed(1)}
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
