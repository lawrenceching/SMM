import { Table, TableCell, TableHead, TableHeader } from "@/components/ui/table"
import { useTranslation } from "@/lib/i18n"
import { rel } from "@/lib/path"
import { MediaFileTableNameValueRow, MediaFileTableTr } from "./MediaFileTableRow"
import {
  UIMediaFileTableEpisodeBlock,
  UIMediaFileTableSeasonBlock,
} from "./MediaFileTableBlocks"
import type { UIMediaFileTableProps } from "./UIMediaFileTable"
import type { MediaFileTableLayoutState } from "./UIMediaFileTable"

const SIMPLE_FIXED_COLUMN_COUNT = 5

function SimpleColGroup({ showCheckboxColumn }: { showCheckboxColumn: boolean }) {
  return (
    <colgroup>
      {showCheckboxColumn && <col className="w-10" />}
      <col className="w-[100px]" />
      <col />
      <col className="w-10" />
      <col className="w-10" />
      <col className="w-10" />
    </colgroup>
  )
}

export interface MediaFileTableSimpleLayoutProps extends UIMediaFileTableProps {
  tableState: MediaFileTableLayoutState
}

export function MediaFileTableSimpleLayout({
  seasonData = [],
  metadataFiles,
  subtitleFiles,
  nfoFiles,
  thumbnailFiles,
  mediaFolderPath,
  checboxVisible = false,
  selectedEpisodes,
  onCheck,
  newFilePaths,
  disableCheckboxIfEpisodeVideoNotAvailable = true,
  tableState,
}: MediaFileTableSimpleLayoutProps) {
  const { t } = useTranslation("components")

  const metadataFieldRows = [
    { name: "poster", path: metadataFiles?.posterPath },
    { name: "fanart", path: metadataFiles?.fanartPath },
    { name: "nfo", path: metadataFiles?.nfoPath },
    { name: "clearlogo", path: metadataFiles?.clearlogoPath },
    { name: "theme", path: metadataFiles?.themePath },
  ]

  const totalColumns = SIMPLE_FIXED_COLUMN_COUNT + (checboxVisible ? 1 : 0)

  return (
    <section data-testid="media-file-table" className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <SimpleColGroup showCheckboxColumn={checboxVisible} />
        <TableHeader>
          <MediaFileTableTr className="hover:bg-transparent">
            {checboxVisible && (
              <TableCell
                className="h-8 w-10 shrink-0 px-0 py-1 text-center"
                title={t("mediaFileTable.renameCheckboxTitle", {
                  defaultValue: "Include in rename",
                })}
              />
            )}
            <TableHead className="h-8 w-[100px] px-2 py-1">
              {t("mediaFileTable.columns.id")}
            </TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">
              {t("mediaFileTable.header.videoFile")}
            </TableHead>
            <TableHead
              className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
              title={t("mediaFileTable.columns.thumbnail")}
            >
              {t("mediaFileTable.header.thumb")}
            </TableHead>
            <TableHead
              className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
              title={t("mediaFileTable.columns.subtitle")}
            >
              {t("mediaFileTable.header.sub")}
            </TableHead>
            <TableHead
              className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
              title={t("mediaFileTable.columns.nfo")}
            >
              {t("mediaFileTable.header.nfo")}
            </TableHead>
          </MediaFileTableTr>
        </TableHeader>

        {metadataFieldRows.map(
          ({ name, path }) =>
            path && (
              <MediaFileTableNameValueRow
                key={name}
                name={name}
                value={rel(mediaFolderPath, path)}
                hoverTitle={path}
                showCheckboxColumn={checboxVisible}
              />
            ),
        )}

        {seasonData.map((season) => {
          const collapsibleId = `season-${season.season}`
          const isCollapsed = tableState.collapsedIds.has(collapsibleId)
          return (
            <UIMediaFileTableSeasonBlock
              key={collapsibleId}
              season={season}
              items={tableState.episodeContextMenuItems}
              isCollapsed={isCollapsed}
              onOpenChange={(open) => tableState.setSectionCollapsed(collapsibleId, !open)}
              showCheckboxColumn={checboxVisible}
              visibleColumnCount={totalColumns}
            >
              <UIMediaFileTableEpisodeBlock
                season={season}
                mediaFolderPath={mediaFolderPath}
                subtitleFiles={subtitleFiles}
                nfoFiles={nfoFiles}
                thumbnailFiles={thumbnailFiles}
                newFilePaths={newFilePaths}
                checboxVisible={checboxVisible}
                onCheck={onCheck}
                selectedEpisodes={selectedEpisodes}
                disableCheckboxIfEpisodeVideoNotAvailable={disableCheckboxIfEpisodeVideoNotAvailable}
              />
            </UIMediaFileTableSeasonBlock>
          )
        })}
      </Table>
    </section>
  )
}
