import { Fragment, type ReactNode } from "react"
import {
    MoreVertical,
    List,
    LayoutGrid,
    PanelTop,
    ChevronDown,
    Scan,
    FileEdit,
    Download,
    Captions,
    FileVideo,
    Sparkles,
    ExternalLink,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type EpisodeTableLayout = "simple" | "detail" | "preview"

export type MediaFileTableMenuId =
    | "recognize"
    | "rename"
    | "scrape"
    | "subtitle"
    | "transcribe"
    | "translate"
    | "synthesize"
    | "process"
    | "openExternal"

export type MediaFileTableToolbarCollapseAt = 410 | 310 | 220 | 200

export interface MediaFileTableToolbarProps {
    leading: ReactNode
    loading?: boolean
    layout?: EpisodeTableLayout
    onLayoutChange?: (layout: EpisodeTableLayout) => void
    /** When false, the preview layout button/menu item is hidden (e.g. HarmonyOS). */
    showPreviewLayoutButton?: boolean
    /**
     * When true (default), leading is capped at 50% width so action buttons keep room
     * (TV layout). Movie historically used full flex-1 for the searchbox — set false there.
     */
    constrainLeading?: boolean
    hiddenMenuIds?: MediaFileTableMenuId[]
    disabledMenuIds?: MediaFileTableMenuId[]
    onRecognizeButtonClick?: () => void
    onRenameButtonClick?: () => void
    onScrapeButtonClick?: () => void
    onTranscribeClick?: () => void
    onTranslateClick?: () => void
    onSynthesizeClick?: () => void
    onProcessClick?: () => void
    /** Toolbar opens this URL for Open in TMDB/TVDB. Missing URL disables that item. */
    externalUrl?: string
    /** Prefix for subtitle-related test ids, e.g. `tvshow-header` / `movie-header`. */
    testIdPrefix?: string
}

const BUTTON_COLLAPSE_CLASS: Record<MediaFileTableToolbarCollapseAt, string> = {
    410: "hidden @[410px]:inline-flex",
    310: "hidden @[310px]:inline-flex",
    220: "hidden @[220px]:inline-flex",
    200: "hidden @[200px]:inline-flex",
}

const OVERFLOW_COLLAPSE_CLASS: Record<MediaFileTableToolbarCollapseAt, string> = {
    410: "@[410px]:hidden",
    310: "@[310px]:hidden",
    220: "@[220px]:hidden",
    200: "@[200px]:hidden",
}

function isHidden(ids: MediaFileTableMenuId[] | undefined, id: MediaFileTableMenuId): boolean {
    return ids?.includes(id) ?? false
}

function isDisabled(ids: MediaFileTableMenuId[] | undefined, id: MediaFileTableMenuId): boolean {
    return ids?.includes(id) ?? false
}

function isTvdbUrl(url: string | undefined): boolean {
    return !!url && url.includes("thetvdb.com")
}

export function MediaFileTableToolbar({
    leading,
    loading = false,
    layout = "simple",
    onLayoutChange,
    showPreviewLayoutButton = true,
    constrainLeading = true,
    hiddenMenuIds,
    disabledMenuIds,
    onRecognizeButtonClick,
    onRenameButtonClick,
    onScrapeButtonClick,
    onTranscribeClick,
    onTranslateClick,
    onSynthesizeClick,
    onProcessClick,
    externalUrl,
    testIdPrefix = "media-file-table-toolbar",
}: MediaFileTableToolbarProps) {
    const { t } = useTranslation(["components"])
    const simpleLabel = t("tvShow.layoutSimple", { ns: "components", defaultValue: "Simple layout" })
    const detailLabel = t("tvShow.layoutDetail", { ns: "components", defaultValue: "Detail layout" })
    const previewLabel = t("tvShow.layoutPreview", { ns: "components", defaultValue: "Preview layout" })
    const moreAriaLabel = t("tvShow.more", { ns: "components", defaultValue: "More" })

    const showRecognize = !isHidden(hiddenMenuIds, "recognize")
    const showRename = !isHidden(hiddenMenuIds, "rename")
    const showScrape = !isHidden(hiddenMenuIds, "scrape")
    const showSubtitle = !isHidden(hiddenMenuIds, "subtitle")
    const showOpenExternal = !isHidden(hiddenMenuIds, "openExternal")

    const showTranscribe = showSubtitle && !isHidden(hiddenMenuIds, "transcribe")
    const showTranslate = showSubtitle && !isHidden(hiddenMenuIds, "translate")
    const showSynthesize = showSubtitle && !isHidden(hiddenMenuIds, "synthesize")
    const showProcess = showSubtitle && !isHidden(hiddenMenuIds, "process")

    const transcribeDisabled = isDisabled(disabledMenuIds, "transcribe")
    const translateDisabled = isDisabled(disabledMenuIds, "translate")
    const synthesizeDisabled = isDisabled(disabledMenuIds, "synthesize")
    const processDisabled = isDisabled(disabledMenuIds, "process")

    const visibleSubtitleChildrenDisabled = [
        showTranscribe && transcribeDisabled,
        showTranslate && translateDisabled,
        showSynthesize && synthesizeDisabled,
        showProcess && processDisabled,
    ].filter((entry) => entry !== false)

    const allVisibleSubtitleChildrenDisabled =
        visibleSubtitleChildrenDisabled.length > 0 &&
        visibleSubtitleChildrenDisabled.every(Boolean)

    const subtitleDisabled =
        isDisabled(disabledMenuIds, "subtitle") || allVisibleSubtitleChildrenDisabled

    const openExternalDisabled =
        !externalUrl || isDisabled(disabledMenuIds, "openExternal")

    const openExternalLabel = isTvdbUrl(externalUrl)
        ? t("tvShow.openInTvdb", { ns: "components", defaultValue: "Open in TVDB" })
        : t("tvShow.openInTmdb", { ns: "components", defaultValue: "Open in TMDB" })

    const primaryButtonCount =
        Number(showRecognize) + Number(showRename) + Number(showScrape) + Number(showSubtitle)
    const skeletonCount = Math.max(primaryButtonCount, 2)

    return (
        <div className="relative w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div
                    className="flex-1 min-w-0"
                    style={constrainLeading ? { minWidth: "25%", maxWidth: "50%" } : undefined}
                >
                    {loading ? (
                        <Skeleton className="h-9 w-full max-w-md" />
                    ) : (
                        leading
                    )}
                </div>
                <div className="@container flex flex-1 min-w-0 flex-nowrap justify-end gap-2 items-center">
                    {onLayoutChange && (
                        <LayoutSwitcher
                            layout={layout}
                            onLayoutChange={onLayoutChange}
                            simpleLabel={simpleLabel}
                            detailLabel={detailLabel}
                            previewLabel={previewLabel}
                            showPreviewLayoutButton={showPreviewLayoutButton}
                            disabled={loading}
                        />
                    )}
                    {loading ? (
                        <>
                            {Array.from({ length: skeletonCount }, (_, index) => (
                                <Skeleton
                                    key={index}
                                    className={index === 0 ? "h-9 w-28" : "h-9 w-24"}
                                />
                            ))}
                        </>
                    ) : (
                        <>
                            {showRecognize && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={BUTTON_COLLAPSE_CLASS[410]}
                                    disabled={isDisabled(disabledMenuIds, "recognize")}
                                    onClick={() => onRecognizeButtonClick?.()}
                                    data-testid="recognize-button"
                                >
                                    <Scan className="size-4 mr-2" />
                                    {t("tvShow.recognize", { ns: "components", defaultValue: "Recognize" })}
                                </Button>
                            )}
                            {showRename && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={BUTTON_COLLAPSE_CLASS[310]}
                                    disabled={isDisabled(disabledMenuIds, "rename")}
                                    onClick={() => onRenameButtonClick?.()}
                                    data-testid="rename-button"
                                >
                                    <FileEdit className="size-4 mr-2" />
                                    {t("tvShow.rename", { ns: "components" })}
                                </Button>
                            )}
                            {showScrape && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={BUTTON_COLLAPSE_CLASS[220]}
                                    disabled={isDisabled(disabledMenuIds, "scrape")}
                                    onClick={() => onScrapeButtonClick?.()}
                                    data-testid="scrape-button"
                                >
                                    <Download className="size-4 mr-2" />
                                    {t("tvShow.scrape", { ns: "components" })}
                                </Button>
                            )}
                            {showSubtitle && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={BUTTON_COLLAPSE_CLASS[200]}
                                            disabled={subtitleDisabled}
                                            data-testid={`${testIdPrefix}-subtitle`}
                                        >
                                            <Captions className="size-4 mr-2" />
                                            {t("mediaPlayer.trackContextMenu.subtitle", { ns: "components" })}
                                            <ChevronDown className="size-4 ml-1 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        {showTranscribe && (
                                            <DropdownMenuItem
                                                disabled={transcribeDisabled}
                                                onClick={() => onTranscribeClick?.()}
                                                data-testid={`${testIdPrefix}-transcribe`}
                                            >
                                                <Captions className="size-4 mr-2" />
                                                {t("mediaPlayer.trackContextMenu.transcribe", { ns: "components" })}
                                            </DropdownMenuItem>
                                        )}
                                        {showTranslate && (
                                            <DropdownMenuItem
                                                disabled={translateDisabled}
                                                onClick={() => onTranslateClick?.()}
                                                data-testid={`${testIdPrefix}-translate`}
                                            >
                                                {t("mediaPlayer.trackContextMenu.translate", { ns: "components" })}
                                            </DropdownMenuItem>
                                        )}
                                        {showSynthesize && (
                                            <DropdownMenuItem
                                                disabled={synthesizeDisabled}
                                                onClick={() => onSynthesizeClick?.()}
                                                data-testid={`${testIdPrefix}-synthesize`}
                                            >
                                                <FileVideo className="size-4 mr-2" />
                                                {t("mediaPlayer.trackContextMenu.synthesize", { ns: "components" })}
                                            </DropdownMenuItem>
                                        )}
                                        {showProcess && (
                                            <DropdownMenuItem
                                                disabled={processDisabled}
                                                onClick={() => onProcessClick?.()}
                                                data-testid={`${testIdPrefix}-process`}
                                            >
                                                <Sparkles className="size-4 mr-2" />
                                                {t("mediaPlayer.trackContextMenu.process", { ns: "components" })}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 shrink-0"
                                        aria-label={moreAriaLabel}
                                    >
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {onLayoutChange && (
                                        <>
                                            <DropdownMenuItem
                                                className="@[520px]:hidden"
                                                disabled={loading}
                                                onClick={() => onLayoutChange("simple")}
                                            >
                                                <List className="size-4" />
                                                {simpleLabel}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="@[520px]:hidden"
                                                disabled={loading}
                                                onClick={() => onLayoutChange("detail")}
                                            >
                                                <LayoutGrid className="size-4" />
                                                {detailLabel}
                                            </DropdownMenuItem>
                                            {showPreviewLayoutButton && (
                                                <DropdownMenuItem
                                                    className="@[520px]:hidden"
                                                    disabled={loading}
                                                    onClick={() => onLayoutChange("preview")}
                                                >
                                                    <PanelTop className="size-4" />
                                                    {previewLabel}
                                                </DropdownMenuItem>
                                            )}
                                        </>
                                    )}
                                    {showRecognize && (
                                        <DropdownMenuItem
                                            className={OVERFLOW_COLLAPSE_CLASS[410]}
                                            disabled={isDisabled(disabledMenuIds, "recognize")}
                                            onClick={() => onRecognizeButtonClick?.()}
                                        >
                                            <Scan className="size-4" />
                                            {t("tvShow.recognize", { ns: "components", defaultValue: "Recognize" })}
                                        </DropdownMenuItem>
                                    )}
                                    {showRename && (
                                        <DropdownMenuItem
                                            className={OVERFLOW_COLLAPSE_CLASS[310]}
                                            disabled={isDisabled(disabledMenuIds, "rename")}
                                            onClick={() => onRenameButtonClick?.()}
                                        >
                                            <FileEdit className="size-4" />
                                            {t("tvShow.rename", { ns: "components" })}
                                        </DropdownMenuItem>
                                    )}
                                    {showScrape && (
                                        <DropdownMenuItem
                                            className={OVERFLOW_COLLAPSE_CLASS[220]}
                                            disabled={isDisabled(disabledMenuIds, "scrape")}
                                            onClick={() => onScrapeButtonClick?.()}
                                        >
                                            <Download className="size-4" />
                                            {t("tvShow.scrape", { ns: "components" })}
                                        </DropdownMenuItem>
                                    )}
                                    {showSubtitle && (
                                        <Fragment>
                                            <DropdownMenuSeparator className={OVERFLOW_COLLAPSE_CLASS[200]} />
                                            {showTranscribe && (
                                                <DropdownMenuItem
                                                    className={OVERFLOW_COLLAPSE_CLASS[200]}
                                                    disabled={transcribeDisabled}
                                                    onClick={() => onTranscribeClick?.()}
                                                    data-testid={`${testIdPrefix}-transcribe-overflow`}
                                                >
                                                    <Captions className="size-4" />
                                                    {t("mediaPlayer.trackContextMenu.transcribe", { ns: "components" })}
                                                </DropdownMenuItem>
                                            )}
                                            {showTranslate && (
                                                <DropdownMenuItem
                                                    className={OVERFLOW_COLLAPSE_CLASS[200]}
                                                    disabled={translateDisabled}
                                                    onClick={() => onTranslateClick?.()}
                                                    data-testid={`${testIdPrefix}-translate-overflow`}
                                                >
                                                    {t("mediaPlayer.trackContextMenu.translate", { ns: "components" })}
                                                </DropdownMenuItem>
                                            )}
                                            {showSynthesize && (
                                                <DropdownMenuItem
                                                    className={OVERFLOW_COLLAPSE_CLASS[200]}
                                                    disabled={synthesizeDisabled}
                                                    onClick={() => onSynthesizeClick?.()}
                                                    data-testid={`${testIdPrefix}-synthesize-overflow`}
                                                >
                                                    <FileVideo className="size-4 mr-2" />
                                                    {t("mediaPlayer.trackContextMenu.synthesize", { ns: "components" })}
                                                </DropdownMenuItem>
                                            )}
                                            {showProcess && (
                                                <DropdownMenuItem
                                                    className={OVERFLOW_COLLAPSE_CLASS[200]}
                                                    disabled={processDisabled}
                                                    onClick={() => onProcessClick?.()}
                                                    data-testid={`${testIdPrefix}-process-overflow`}
                                                >
                                                    <Sparkles className="size-4 mr-2" />
                                                    {t("mediaPlayer.trackContextMenu.process", { ns: "components" })}
                                                </DropdownMenuItem>
                                            )}
                                        </Fragment>
                                    )}
                                    {showOpenExternal && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                disabled={openExternalDisabled}
                                                onClick={() => {
                                                    if (!externalUrl) return
                                                    window.open(externalUrl, "_blank", "noopener,noreferrer")
                                                }}
                                            >
                                                <ExternalLink className="size-4" />
                                                {openExternalLabel}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function LayoutSwitcher({
    layout,
    onLayoutChange,
    simpleLabel,
    detailLabel,
    previewLabel,
    showPreviewLayoutButton,
    disabled,
}: {
    layout: EpisodeTableLayout
    onLayoutChange: (layout: EpisodeTableLayout) => void
    simpleLabel: string
    detailLabel: string
    previewLabel: string
    showPreviewLayoutButton: boolean
    disabled: boolean
}) {
    return (
        <div className="hidden @[520px]:inline-flex items-center rounded-md border border-input bg-background shadow-xs">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onLayoutChange("simple")}
                disabled={disabled}
                className={cn(
                    "h-9 w-9 rounded-none rounded-l-md transition-all",
                    layout === "simple"
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground",
                )}
                title={simpleLabel}
                aria-label={simpleLabel}
                aria-pressed={layout === "simple"}
            >
                <List className="size-4" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onLayoutChange("detail")}
                disabled={disabled}
                className={cn(
                    "h-9 w-9 rounded-none transition-all",
                    layout === "detail"
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground",
                    !showPreviewLayoutButton && "rounded-r-md",
                )}
                title={detailLabel}
                aria-label={detailLabel}
                aria-pressed={layout === "detail"}
            >
                <LayoutGrid className="size-4" />
            </Button>
            {showPreviewLayoutButton && (
                <>
                    <div className="h-4 w-px bg-border" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onLayoutChange("preview")}
                        disabled={disabled}
                        className={cn(
                            "h-9 w-9 rounded-none rounded-r-md transition-all",
                            layout === "preview"
                                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                                : "hover:bg-accent hover:text-accent-foreground",
                        )}
                        title={previewLabel}
                        aria-label={previewLabel}
                        aria-pressed={layout === "preview"}
                    >
                        <PanelTop className="size-4" />
                    </Button>
                </>
            )}
        </div>
    )
}
