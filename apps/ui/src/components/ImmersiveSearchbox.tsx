import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveInput } from "./ImmersiveInput"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import type { PrimaryDatabase } from "@core/types"

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
    onSelect: (result: ImmersiveSearchResultItem) => void
    searchResults: ImmersiveSearchResultItem[]
    isSearching: boolean
    searchError: string | null
    className?: string
    placeholder?: string
    inputClassName?: string
    /** When set, a Hover Card with this hint is always shown (not triggered by hover). */
    unrecognizedHint?: string
    searchDatabase?: PrimaryDatabase
    onSearchDatabaseChange?: (value: PrimaryDatabase) => void
    searchLanguage?: SupportedLanguage
    onSearchLanguageChange?: (value: SupportedLanguage) => void
    /** When true, result rows are not selectable (e.g. TVDB search-only mode). */
    disableSelect?: boolean
    /** Shown when disableSelect is true and there are results; explains why selection is disabled. */
    disabledSelectReason?: React.ReactNode
}

export interface ImmersiveSearchResultItem {
    id: string | number
    displayName: string
    originalName?: string
    overview?: string
    posterUrl?: string | null
    dateText?: string
    voteAverage?: number
    raw: unknown
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
    searchDatabase,
    onSearchDatabaseChange,
    searchLanguage,
    onSearchLanguageChange,
    disableSelect = false,
    disabledSelectReason,
}: ImmersiveSearchboxProps) {
    const { t } = useTranslation(["components"])
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

    const handleInputFocus = React.useCallback(() => {
        setIsSearchOpen(true)
    }, [])

    const handleSearchButtonClick = React.useCallback(() => {
        if (!isSearchOpen) {
            setIsSearchOpen(true)
        }
        setTimeout(() => {
            inputContainerRef.current?.querySelector('input')?.focus()
        }, 0)
        onSearch()
    }, [isSearchOpen, onSearch])

    const handleSelectResult = React.useCallback((result: ImmersiveSearchResultItem) => {
        if (disableSelect) return
        setIsSearchOpen(false)
        onSelect(result)
    }, [onSelect, disableSelect])

    const handleContainerClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement
        const input = inputContainerRef.current?.querySelector('input')
        if (input && target !== input && !target.closest('button')) {
            input.focus()
        }
    }, [])

    return (
        <div className={cn("w-full min-w-0", className)}>
            <Popover 
                open={isSearchOpen} 
                onOpenChange={setIsSearchOpen}
                modal={false}
            >
                <PopoverAnchor asChild>
                    <div ref={inputContainerRef} className="w-full min-w-0 cursor-text" onClick={handleContainerClick}>
                        {unrecognizedHint ? (
                            <HoverCard open openDelay={0} onOpenChange={() => {}}>
                                <HoverCardTrigger asChild>
                                    <div className="w-full min-w-0">
                                        <ImmersiveInput
                                            value={value}
                                            onChange={(e) => onChange(e.target.value)}
                                            onFocus={handleInputFocus}
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
                                onFocus={handleInputFocus}
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
                    onOpenAutoFocus={(e) => {
                        e.preventDefault()
                        inputContainerRef.current?.querySelector<HTMLInputElement>('input')?.focus()
                    }}
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement
                        if (inputContainerRef.current?.contains(target)) {
                            e.preventDefault()
                        }
                    }}
                >
                    {(searchDatabase && searchLanguage && onSearchDatabaseChange && onSearchLanguageChange) && (
                        <div className="px-2 pt-2 pb-1 border-b border-border">
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                        {t("components:tmdbSearchbox.database" as "components:movie.searchPlaceholder")}
                                    </Label>
                                    <Select
                                        value={searchDatabase}
                                        onValueChange={(v) => onSearchDatabaseChange(v as PrimaryDatabase)}
                                    >
                                        <SelectTrigger id="tmdb-search-database" size="sm" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TMDB">TMDB</SelectItem>
                                            <SelectItem value="TVDB">TVDB</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                        {t("components:tmdbSearchbox.searchLanguage" as "components:movie.searchPlaceholder")}
                                    </Label>
                                    <Select
                                        value={searchLanguage}
                                        onValueChange={(v) => onSearchLanguageChange(v as SupportedLanguage)}
                                    >
                                        <SelectTrigger id="tmdb-search-language" size="sm" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_LANGUAGES.map((lang) => (
                                                <SelectItem key={lang.code} value={lang.code}>
                                                    {lang.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
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
                                <>
                                    {disableSelect && disabledSelectReason && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                                            {disabledSelectReason}
                                        </div>
                                    )}
                                    {searchResults.map((result) => {
                                    const voteAvg = result.voteAverage ?? 0
                                    return (
                                        <div
                                            key={result.id}
                                            onClick={() => handleSelectResult(result)}
                                            className={cn(
                                                "flex gap-3 p-3 rounded-md transition-colors",
                                                disableSelect ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:bg-accent"
                                            )}
                                        >
                                            {result.posterUrl && (
                                                <div className="shrink-0">
                                                    <img
                                                        src={result.posterUrl}
                                                        alt={result.displayName}
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
                                                    {result.displayName}
                                                </h3>
                                                {result.originalName && result.originalName !== result.displayName && (
                                                    <p className="text-sm text-muted-foreground mb-1">
                                                        {result.originalName}
                                                    </p>
                                                )}
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                    {result.overview || 'No overview available'}
                                                </p>
                                                {(result.dateText || voteAvg > 0) && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        {result.dateText && (
                                                            <span>{formatDate(result.dateText)}</span>
                                                        )}
                                                        {result.dateText && voteAvg > 0 && (
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
                                })}
                                </>
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
