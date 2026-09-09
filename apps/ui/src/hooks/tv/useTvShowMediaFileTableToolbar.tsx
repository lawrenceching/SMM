import { useMemo } from "react"
import type { MediaMetadata } from "@smm/types"
import type { UIMediaFolder } from "@/types/UIMediaFolder"
import { MediaDatabaseSearchbox } from "@/components/MediaDatabaseSearchbox"
import type { SearchResultSelectedArgs } from "@/components/MediaDatabaseSearchbox"
import {
  MediaFileTableToolbar,
  type EpisodeTableLayout,
  type MediaFileTableToolbarProps,
} from "@/components/media/MediaFileTableToolbar"
import { useTranslation } from "@/lib/i18n"
import { isHarmonyOS } from "@/lib/isHarmonyOS"
import {
  buildActionDisabledMenuIds,
  buildSubtitleHiddenMenuIds,
  isMediaFileTableToolbarLoading,
} from "../media/mediaFileTableToolbarShared"

export type { EpisodeTableLayout }

export interface UseTvShowMediaFileTableToolbarArgs {
  onSearchResultSelected: (args: SearchResultSelectedArgs) => void
  onRecognizeButtonClick?: () => void
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

export function useTvShowMediaFileTableToolbar({
  onSearchResultSelected,
  onRecognizeButtonClick,
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
}: UseTvShowMediaFileTableToolbarArgs): MediaFileTableToolbarProps {
  const { t } = useTranslation(["components", "errors", "dialogs"])
  const isHarmonyOSRuntime = useMemo(() => isHarmonyOS(), [])

  const tvShow = selectedMediaMetadata?.tvShow
  const movie = selectedMediaMetadata?.movie
  const folderStatus = selectedMediaFolder?.status
  const loading = isMediaFileTableToolbarLoading(folderStatus, selectedMediaFolder === undefined)
  const isMediaMetadataOk = folderStatus === "ok"
  const initialSearchValue = tvShow?.name ?? ""

  const hasValidTvShow = (tvShow != null && tvShow.id != null) || selectedMediaMetadata?.tvShow != null
  const actionsDisabled = !hasValidTvShow
  const unrecognizedHint =
    isMediaMetadataOk && actionsDisabled
      ? (t("tvShow.unrecognizedFolderHint" as any, { ns: "components" }) as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      : undefined

  const database = tvShow?.database ?? movie?.database
  const mediaId = tvShow?.id ?? movie?.id
  const mediaName = tvShow?.name ?? movie?.name ?? ""
  const externalUrl = mediaId
    ? database === "TVDB"
      ? `https://www.thetvdb.com/search?query=${encodeURIComponent(`${mediaId} ${mediaName}`)}`
      : tvShow?.id != null
        ? `https://www.themoviedb.org/tv/${mediaId}`
        : `https://www.themoviedb.org/movie/${mediaId}`
    : undefined

  const scrapeBlocked =
    actionsDisabled ||
    !selectedMediaMetadata?.mediaFiles ||
    selectedMediaMetadata.mediaFiles.length === 0

  const hiddenMenuIds = useMemo(
    () => buildSubtitleHiddenMenuIds(showSubtitleMenu),
    [showSubtitleMenu],
  )

  const disabledMenuIds = useMemo(
    () =>
      buildActionDisabledMenuIds({
        actionsDisabled,
        scrapeBlocked,
        includeRecognize: true,
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
        mediaType="tv"
        value={initialSearchValue}
        onSearchResultSelected={onSearchResultSelected}
        placeholder={t("tvShow.searchPlaceholder", { ns: "components" })}
        inputClassName="text-lg font-semibold"
        unrecognizedHint={unrecognizedHint}
      />
    ),
    loading,
    layout: episodeTableLayout,
    onLayoutChange: onEpisodeTableLayoutChange,
    showPreviewLayoutButton: !isHarmonyOSRuntime,
    hiddenMenuIds,
    disabledMenuIds,
    onRecognizeButtonClick: () => {
      console.log("[tvshow] clicked recognize-button")
      onRecognizeButtonClick?.()
    },
    onRenameButtonClick: () => {
      console.log("[tvshow] clicked rename-button")
      onRenameClick?.()
    },
    onScrapeButtonClick: () => {
      if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tvShow) return
      openScrape?.({ mediaMetadata: selectedMediaMetadata })
    },
    onTranscribeClick,
    onTranslateClick,
    onSynthesizeClick,
    onProcessClick,
    externalUrl,
    testIdPrefix: "tvshow-header",
  }
}

/** Test/render helper: hook + toolbar in one component. */
export function TvShowMediaFileTableToolbar(props: UseTvShowMediaFileTableToolbarArgs) {
  const toolbarProps = useTvShowMediaFileTableToolbar(props)
  return <MediaFileTableToolbar {...toolbarProps} />
}
