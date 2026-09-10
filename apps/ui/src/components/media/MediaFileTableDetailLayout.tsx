import { Table, TableCell, TableHead, TableHeader } from "@/components/ui/table"
import { useTranslation } from "@/lib/i18n"
import { rel } from "@/lib/path"
import {
  MediaFileTableTr,
  UICheckCell,
} from "./MediaFileTableRow"
import {
  UIMediaFileTableEpisodeDetailBlock,
  UIMediaFileTableSeasonBlock,
} from "./MediaFileTableBlocks"
import type { UIMediaFileTableProps } from "./UIMediaFileTable"
import type { MediaFileTableLayoutState } from "./UIMediaFileTable"
import type { MetadataFiles } from "@smm/types/MetadataFiles"

const DETAIL_FIXED_COLUMN_COUNT = 5

function DetailColGroup({ showCheckboxColumn }: { showCheckboxColumn: boolean }) {
  return (
    <colgroup>
      {showCheckboxColumn && <col className="w-10" />}
      <col className="w-[100px]" />
      <col className="w-[100px] min-w-[100px]" />
      <col />
      <col className="w-10" />
      <col className="w-10" />
    </colgroup>
  )
}

function DetailMetadataRows({
  metadataFiles,
  mediaFolderPath,
  showCheckboxColumn,
}: {
  metadataFiles?: MetadataFiles
  mediaFolderPath?: string
  showCheckboxColumn: boolean
}) {
  const fieldRows = [
    { name: "poster", path: metadataFiles?.posterPath },
    { name: "fanart", path: metadataFiles?.fanartPath },
    { name: "nfo", path: metadataFiles?.nfoPath },
    { name: "clearlogo", path: metadataFiles?.clearlogoPath },
    { name: "theme", path: metadataFiles?.themePath },
  ]

  return (
    <>
      {fieldRows.map(
        ({ name, path }) =>
          path && (
            <MediaFileTableTr key={name}>
              {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
              <TableCell className="px-2 py-1 font-mono w-[100px]">{name}</TableCell>
              <TableCell className="w-[100px] min-w-[100px] px-1 py-1" />
              <TableCell className="max-w-px px-2 py-1">
                <span title={path}>{rel(mediaFolderPath, path)}</span>
              </TableCell>
              <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                <UICheckCell value={undefined} />
              </TableCell>
              <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                <UICheckCell value={undefined} />
              </TableCell>
            </MediaFileTableTr>
          ),
      )}
    </>
  )
}

export interface MediaFileTableDetailLayoutProps extends UIMediaFileTableProps {
  tableState: MediaFileTableLayoutState
}

export function MediaFileTableDetailLayout({
  seasonData = [],
  metadataFiles,
  mediaFolderPath,
  checboxVisible = false,
  onCheck,
  selectedEpisodes,
  disableCheckboxIfEpisodeVideoNotAvailable = true,
  tableState,
}: MediaFileTableDetailLayoutProps) {
  const { t } = useTranslation("components")

  const totalColumns = DETAIL_FIXED_COLUMN_COUNT + (checboxVisible ? 1 : 0)

  return (
    <section data-testid="media-file-table" className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <DetailColGroup showCheckboxColumn={checboxVisible} />
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
            <TableHead
              className="h-8 w-[100px] min-w-[100px] px-1 py-1"
              title={t("mediaFileTable.columns.thumbnail")}
            >
              {t("mediaFileTable.header.thumb")}
            </TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">
              {t("mediaFileTable.header.videoFile")}
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

        <DetailMetadataRows
          metadataFiles={metadataFiles}
          mediaFolderPath={mediaFolderPath}
          showCheckboxColumn={checboxVisible}
        />

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
              <UIMediaFileTableEpisodeDetailBlock
                season={season}
                mediaFolderPath={mediaFolderPath}
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
