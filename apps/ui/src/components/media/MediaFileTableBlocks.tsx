import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRightIcon } from "lucide-react"
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { rel } from "@/lib/path"
import { head } from "es-toolkit"
import {
  EpisodeContextMenu,
  type EpisodeContextMenuItem,
  MediaFileTableEpisodeDetailRow,
  MediaFileTableEpisodePreviewRow,
  MediaFileTableEpisodeSimpleRow,
} from "./MediaFileTableRow"
import type { MediaFileTableSeasonData } from "./UIMediaFileTable"

const collapsibleSectionContentClassName = cn(
  "media-file-table-section-content overflow-hidden",
  "data-[state=closed]:animate-[media-file-table-collapsible-up_200ms_ease-out]",
  "data-[state=open]:animate-[media-file-table-collapsible-down_200ms_ease-out]",
)

/**
 * Collapsible season section for the `seasonData`-driven path: a header row
 * (season title + collapse toggle) above the season content.
 *
 * The season content is supplied as `children`, e.g.
 * `<UIMediaFileTableEpisodeBlock season={season} />`. When the child is an
 * `UIMediaFileTableEpisodeBlock`, this block's `items` are forwarded into it,
 * so the caller can compose the episode rows as children while the episode
 * menu items stay owned by the section.
 */
export function UIMediaFileTableSeasonBlock({
  season,
  items = [],
  isCollapsed,
  onOpenChange,
  showCheckboxColumn,
  visibleColumnCount,
  children,
}: {
  season: MediaFileTableSeasonData
  /** Right-click menu items for each episode row (forwarded to the episode block child). */
  items?: EpisodeContextMenuItem[]
  /** Whether the section is currently collapsed (controlled by the table). */
  isCollapsed: boolean
  /** Called with the new open state when the user toggles the section. */
  onOpenChange: (open: boolean) => void
  showCheckboxColumn: boolean
  visibleColumnCount: number
  /** Content rendered below the season header (e.g. `UIMediaFileTableEpisodeBlock`). */
  children?: ReactNode
}) {
  const { t } = useTranslation("components")
  const expandLabel = t("mediaFileTable.expand")
  const collapseLabel = t("mediaFileTable.collapse")

  // Compose the caller-supplied content. When it is one of the episode blocks
  // (simple/detail/preview), forward this section's `items` so the per-row
  // context menus keep working without the caller having to repeat the items
  // on the child.
  const content =
    isValidElement(children) &&
    (children.type === UIMediaFileTableEpisodeBlock ||
      children.type === UIMediaFileTableEpisodeDetailBlock ||
      children.type === UIMediaFileTableEpisodePreviewBlock)
      ? cloneElement(children as ReactElement<UIMediaFileTableEpisodeBlockProps>, {
          items,
        })
      : children

  return (
    <Collapsible asChild open={!isCollapsed} onOpenChange={onOpenChange}>
      <TableBody className="group/section">
        <TableRow className="bg-muted/60 hover:bg-muted/70">
          {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
          <TableCell
            colSpan={visibleColumnCount - (showCheckboxColumn ? 1 : 0)}
            className="px-2 py-1.5 font-semibold"
          >
            <div className="flex items-center justify-between gap-2">
              <span>{season.title}</span>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={isCollapsed ? expandLabel : collapseLabel}
                  aria-label={isCollapsed ? expandLabel : collapseLabel}
                  aria-expanded={!isCollapsed}
                >
                  <ChevronRightIcon className="size-4 transition-transform duration-200 group-data-[state=open]/section:rotate-90" />
                </button>
              </CollapsibleTrigger>
            </div>
          </TableCell>
        </TableRow>
        <TableRow className="border-b-0 hover:bg-transparent">
          <TableCell colSpan={visibleColumnCount} className="p-0 border-0 align-top">
            <CollapsibleContent className={collapsibleSectionContentClassName}>
              {content}
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </TableBody>
    </Collapsible>
  )
}

/** Shared props of the season content blocks (`EpisodeBlock` / `EpisodeDetailBlock` /
 * `EpisodePreviewBlock`) rendered inside `UIMediaFileTableSeasonBlock`. */
export interface UIMediaFileTableEpisodeBlockProps {
  season: MediaFileTableSeasonData
  /** Right-click menu items for each episode row. */
  items?: EpisodeContextMenuItem[]
  /** When set, paths are shown relative to this base. */
  mediaFolderPath?: string
  subtitleFiles?: { season: number, episode: number, files: string[] }[]
  nfoFiles?: { season: number, episode: number, files: string[] }[]
  thumbnailFiles?: { season: number, episode: number, files: string[] }[]
  newFilePaths?: { season: number, episode: number, newFilePath: string }[]
  checboxVisible?: boolean,
  onCheck?: (season: number, episode: number, checked: boolean) => void,
  selectedEpisodes?: { season: number, episode: number }[]
  /**
   * When `true` (default), episodes without a video file (`MediaFileTableEpisodeData.path`
   * is undefined) render their checkbox as disabled.
   */
  disableCheckboxIfEpisodeVideoNotAvailable?: boolean
}

export function UIMediaFileTableEpisodeBlock({
  season,
  items = [],
  mediaFolderPath,
  subtitleFiles,
  nfoFiles,
  thumbnailFiles,
  newFilePaths,
  checboxVisible = false,
  onCheck,
  selectedEpisodes,
  disableCheckboxIfEpisodeVideoNotAvailable = true,
}: UIMediaFileTableEpisodeBlockProps) {
  return (
    <table className="w-full table-fixed text-xs">
      <TableBody>
        {season.episodes.map((episode) => {

          const subtitle = subtitleFiles?.find((subtitle) => subtitle.season === season.season && subtitle.episode === episode.episode)
          const subtitlePath = head(subtitle?.files ?? [])

          const nfo = nfoFiles?.find((nfo) => nfo.season === season.season && nfo.episode === episode.episode)
          const nfoPath = head(nfo?.files ?? [])

          const thumbnail = thumbnailFiles?.find((thumbnail) => thumbnail.season === season.season && thumbnail.episode === episode.episode)
          const thumbnailPath = head(thumbnail?.files ?? [])

          const newFilePath: string | undefined = newFilePaths?.find((newFilePath) => newFilePath.season === season.season && newFilePath.episode === episode.episode)?.newFilePath

          return (
            <EpisodeContextMenu
              key={`season-${season.season}-episode-${episode.episode}`}
              episode={episode}
              items={items}
            >
              <MediaFileTableEpisodeSimpleRow
                season={season.season}
                episode={episode.episode}
                title={episode.title}
                path={rel(mediaFolderPath, episode.path) || (episode.path ?? "")}
                subtitlePath={subtitlePath}
                nfoPath={nfoPath}
                thumbnailPath={thumbnailPath}
                newFilePath={newFilePath === undefined ? undefined : rel(mediaFolderPath, newFilePath)}
                checboxVisible={checboxVisible}
                isCheckboxDisabled={disableCheckboxIfEpisodeVideoNotAvailable && !episode.path}
                onCheck={(isChecked) => onCheck?.(season.season, episode.episode, isChecked)}
                isChecked={selectedEpisodes?.some((selectedEpisode) => selectedEpisode.season === season.season && selectedEpisode.episode === episode.episode)}
              />
            </EpisodeContextMenu>
          )
        })}
      </TableBody>
    </table>
  )
}

/**
 * `detail`-layout season content block: one `MediaFileTableEpisodeDetailRow`
 * per episode (id + cover thumbnail + title/path), each wrapped with its
 * right-click menu.
 */
export function UIMediaFileTableEpisodeDetailBlock({
  season,
  items = [],
  mediaFolderPath,
  subtitleFiles: _subtitleFiles,
  nfoFiles: _nfoFiles,
  thumbnailFiles: _thumbnailFiles,
  checboxVisible = false,
  onCheck,
  selectedEpisodes,
  disableCheckboxIfEpisodeVideoNotAvailable = true,
}: UIMediaFileTableEpisodeBlockProps) {
  return (
    <table className="w-full table-fixed text-xs">
      <TableBody>
        {season.episodes.map((episode) => (
          <EpisodeContextMenu
            key={`season-${season.season}-episode-${episode.episode}`}
            episode={episode}
            items={items}
          >
            <MediaFileTableEpisodeDetailRow
              season={season.season}
              episode={episode.episode}
              title={episode.title}
              path={rel(mediaFolderPath, episode.path) || (episode.path ?? "")}
              isChecked={selectedEpisodes?.some(
                (selectedEpisode) =>
                  selectedEpisode.season === season.season &&
                  selectedEpisode.episode === episode.episode,
              )}
              isCheckboxDisabled={disableCheckboxIfEpisodeVideoNotAvailable && !episode.path}
              onCheck={
                checboxVisible
                  ? (isChecked) => onCheck?.(season.season, episode.episode, isChecked)
                  : undefined
              }
            />
          </EpisodeContextMenu>
        ))}
      </TableBody>
    </table>
  )
}

/**
 * `preview`-layout season content block: one `MediaFileTableEpisodePreviewRow`
 * per episode (larger cover + id·title/path, no ID column), each wrapped with
 * its right-click menu.
 */
export function UIMediaFileTableEpisodePreviewBlock({
  season,
  items = [],
  mediaFolderPath,
  subtitleFiles: _subtitleFiles,
  nfoFiles: _nfoFiles,
  thumbnailFiles: _thumbnailFiles,
  checboxVisible = false,
  onCheck,
  selectedEpisodes,
  disableCheckboxIfEpisodeVideoNotAvailable = true,
}: UIMediaFileTableEpisodeBlockProps) {
  return (
    <table className="w-full table-fixed text-xs">
      <TableBody>
        {season.episodes.map((episode) => (
          <EpisodeContextMenu
            key={`season-${season.season}-episode-${episode.episode}`}
            episode={episode}
            items={items}
          >
            <MediaFileTableEpisodePreviewRow
              season={season.season}
              episode={episode.episode}
              title={episode.title}
              path={rel(mediaFolderPath, episode.path) || (episode.path ?? "")}
              isChecked={selectedEpisodes?.some(
                (selectedEpisode) =>
                  selectedEpisode.season === season.season &&
                  selectedEpisode.episode === episode.episode,
              )}
              isCheckboxDisabled={disableCheckboxIfEpisodeVideoNotAvailable && !episode.path}
              onCheck={
                checboxVisible
                  ? (isChecked) => onCheck?.(season.season, episode.episode, isChecked)
                  : undefined
              }
            />
          </EpisodeContextMenu>
        ))}
      </TableBody>
    </table>
  )
}
