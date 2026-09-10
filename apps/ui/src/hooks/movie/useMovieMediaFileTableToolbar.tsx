/* eslint-disable react-refresh/only-export-components -- hook module with test helper component */
import { useMemo } from "react"
import type { MediaMetadata } from "@smm/types"
import type { UIMediaFolder } from "@/types/UIMediaFolder"
import { MediaDatabaseSearchbox } from "@/components/MediaDatabaseSearchbox"
import type { SearchResultSelectedArgs } from "@/components/MediaDatabaseSearchbox"
import {
  MediaFileTableToolbar,
  type EpisodeTableLayout,
  type MediaFileTableMenuId,
  type MediaFileTableToolbarProps,
} from "@/components/media/MediaFileTableToolbar"
import { useTranslation } from "@/lib/i18n"
import { isHarmonyOS } from "@/lib/isHarmonyOS"
import {
  buildActionDisabledMenuIds,
  buildSubtitleHiddenMenuIds,
  isMediaFileTableToolbarLoading,
} from "../media/mediaFileTableToolbarShared"

export interface UseMovieMediaFileTableToolbarArgs {
  onSearchResultSelected: (args: SearchResultSelectedArgs) => void
  onRenameClick?: () => void
  onTranscribeClick?: () => void
  onTranslateClick?: () => void
  onSynthesizeClick?: () => void
  onProcessClick?: () => void
  isTranscribeAvailable?: boolean
  hasTranscribeTargets?: boolean
  isTranslateAvailable?: boolean
  hasTranslateTargets?: boolean
  isSynthesizeAvailable?: boolean
  hasSynthesizeTargets?: boolean
  isProcessAvailable?: boolean
  hasProcessTargets?: boolean
  showSubtitleMenu?: boolean
  selectedMediaMetadata?: MediaMetadata
  selectedMediaFolder?: UIMediaFolder
  openScrape?: (params: { mediaMetadata: MediaMetadata }) => void
  episodeTableLayout?: EpisodeTableLayout
  onEpisodeTableLayoutChange?: (layout: EpisodeTableLayout) => void
}

export function useMovieMediaFileTableToolbar({
  onSearchResultSelected,
  onRenameClick,
  onTranscribeClick,
  onTranslateClick,
  onSynthesizeClick,
  onProcessClick,
  isTranscribeAvailable = false,
  hasTranscribeTargets = false,
  isTranslateAvailable = false,
  hasTranslateTargets = false,
  isSynthesizeAvailable = false,
  hasSynthesizeTargets = false,
  isProcessAvailable = false,
  hasProcessTargets = false,
  showSubtitleMenu = true,
  selectedMediaMetadata,
  selectedMediaFolder,
  openScrape,
  episodeTableLayout = "simple",
  onEpisodeTableLayoutChange,
}: UseMovieMediaFileTableToolbarArgs): MediaFileTableToolbarProps {
  const { t } = useTranslation(["components", "errors", "dialogs"])
  const isHarmonyOSRuntime = useMemo(() => isHarmonyOS(), [])

  const folderStatus = selectedMediaFolder?.status
  const movieMeta = selectedMediaMetadata?.movie
  const loading = isMediaFileTableToolbarLoading(folderStatus, selectedMediaFolder === undefined)
  const isMediaMetadataOk = folderStatus === "ok"
  const initialSearchValue = movieMeta?.name ?? ""

  const hasValidMovieMetadata = movieMeta != null
  const actionsDisabled = !hasValidMovieMetadata
  const unrecognizedHint =
    isMediaMetadataOk && actionsDisabled
      ? (t("movie.unrecognizedFolderHint" as any, { ns: "components" }) as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      : undefined

  const database = movieMeta?.database
  const mediaId = movieMeta?.id
  const mediaName = movieMeta?.name ?? ""
  const isTmdb = database === "TMDB"
  const externalUrl = mediaId
    ? isTmdb
      ? `https://www.themoviedb.org/movie/${mediaId}`
      : `https://www.thetvdb.com/search?query=${encodeURIComponent(`${mediaId} ${mediaName}`)}`
    : undefined

  const scrapeBlocked =
    actionsDisabled ||
    !selectedMediaMetadata?.mediaFiles ||
    selectedMediaMetadata.mediaFiles.length === 0

  const hiddenMenuIds = useMemo<MediaFileTableMenuId[]>(() => {
    return ["recognize", ...buildSubtitleHiddenMenuIds(showSubtitleMenu)]
  }, [showSubtitleMenu])

  const disabledMenuIds = useMemo(
    () =>
      buildActionDisabledMenuIds({
        actionsDisabled,
        scrapeBlocked,
        includeRecognize: false,
        isTranscribeAvailable,
        hasTranscribeTargets,
        isTranslateAvailable,
        hasTranslateTargets,
        isSynthesizeAvailable,
        hasSynthesizeTargets,
        isProcessAvailable,
        hasProcessTargets,
      }),
    [
      actionsDisabled,
      scrapeBlocked,
      isTranscribeAvailable,
      hasTranscribeTargets,
      isTranslateAvailable,
      hasTranslateTargets,
      isSynthesizeAvailable,
      hasSynthesizeTargets,
      isProcessAvailable,
      hasProcessTargets,
    ],
  )

  return {
    leading: (
      <MediaDatabaseSearchbox
        mediaType="movie"
        value={initialSearchValue}
        onSearchResultSelected={onSearchResultSelected}
        placeholder={t("movie.searchPlaceholder", { ns: "components" })}
        inputClassName="text-lg font-semibold"
        unrecognizedHint={unrecognizedHint}
      />
    ),
    // Match former MovieHeaderV2: searchbox uses full flex-1 (no 50% cap).
    constrainLeading: false,
    loading,
    layout: episodeTableLayout,
    onLayoutChange: onEpisodeTableLayoutChange,
    showPreviewLayoutButton: !isHarmonyOSRuntime,
    hiddenMenuIds,
    disabledMenuIds,
    onRenameButtonClick: onRenameClick,
    onScrapeButtonClick: () => {
      if (scrapeBlocked || !selectedMediaMetadata) return
      openScrape?.({ mediaMetadata: selectedMediaMetadata })
    },
    onTranscribeClick,
    onTranslateClick,
    onSynthesizeClick,
    onProcessClick,
    externalUrl,
    testIdPrefix: "movie-header",
  }
}

/** Test/render helper: hook + toolbar in one component. */
export function MovieMediaFileTableToolbar(props: UseMovieMediaFileTableToolbarArgs) {
  const toolbarProps = useMovieMediaFileTableToolbar(props)
  return <MediaFileTableToolbar {...toolbarProps} />
}
