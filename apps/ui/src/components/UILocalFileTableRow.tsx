import type { LocalFileTableRowData } from "./MusicFileTable"
import type { RowSubtitleUi } from "@/hooks/useMusicFolderSubtitlePipeline"
import type {
  MusicTableSelection,
  LocalFileTableRowFileMenu,
  LocalFileTableRowSubtitleActions,
} from "@/types/music-table"
import type { AssociatedFile } from "@/types/associated-files"
import type { RunningJob } from "@/types/associated-files"
import { LocalFileRow } from "./LocalFileRow"
import { AssociatedFileRow } from "./AssociatedFileRow"
import { EmptyAssociatedFileRow } from "./EmptyAssociatedFileRow"
import { JobRow } from "./JobRow"

export type { MusicTableSelection, LocalFileTableRowFileMenu, LocalFileTableRowSubtitleActions }

export interface UILocalFileTableRowProps {
  row: LocalFileTableRowData
  mediaFolderPath?: string
  isSelected: boolean
  isExpanded: boolean
  selection: MusicTableSelection
  subtitleUi: RowSubtitleUi
  subtitleActions: LocalFileTableRowSubtitleActions
  fileMenu: LocalFileTableRowFileMenu
  onTrackClick?: (trackId: number) => void
  onToggleExpand: () => void
  associatedFiles: AssociatedFile[]
  matchingJobs: { id: string; jobType: RunningJob["type"] }[]
  isSummarizing?: boolean
  onSummarize?: () => void
  canSummarize?: boolean
}

export function UILocalFileTableRow({
  row,
  mediaFolderPath,
  isSelected,
  isExpanded,
  selection,
  subtitleUi,
  subtitleActions,
  fileMenu,
  onTrackClick,
  onToggleExpand,
  associatedFiles,
  matchingJobs,
  isSummarizing = false,
  onSummarize,
  canSummarize = false,
}: UILocalFileTableRowProps) {
  const hasAssociatedFiles = associatedFiles.length > 0

  return (
    <>
      <LocalFileRow
        row={row}
        mediaFolderPath={mediaFolderPath}
        isSelected={isSelected}
        isExpanded={isExpanded}
        selection={selection}
        subtitleUi={subtitleUi}
        subtitleActions={subtitleActions}
        fileMenu={fileMenu}
        onTrackClick={onTrackClick}
        onToggleExpand={onToggleExpand}
        onSummarize={onSummarize}
        canSummarize={canSummarize}
      />
      {isExpanded && hasAssociatedFiles &&
        associatedFiles.map((file) => (
          <AssociatedFileRow
            key={file.path}
            file={file}
            subtitleActions={subtitleActions}
            subtitleUi={subtitleUi}
          />
        ))}
      {isExpanded && !hasAssociatedFiles && matchingJobs.length === 0 && <EmptyAssociatedFileRow />}
      {matchingJobs.map((job) => (
        <JobRow key={job.id} jobType={job.jobType} />
      ))}
      {isExpanded && isSummarizing && <JobRow key="summarizing" jobType="summarizing" />}
    </>
  )
}
