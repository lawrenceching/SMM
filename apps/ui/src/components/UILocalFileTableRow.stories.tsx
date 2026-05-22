import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import { Table, TableBody } from "@/components/ui/table"
import { UILocalFileTableRow } from "./UILocalFileTableRow"
import type { LocalFileTableRowData } from "./MusicFileTable"
import {
  buildRowSubtitleUi,
  getRowSubtitlePipelineState,
  type RowSubtitlePipelineState,
} from "@/hooks/useMusicFolderSubtitlePipeline"

const placeholderThumb = "https://picsum.photos/seed/smm-ui-music-row/112/64"

const baseRow: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  title: "Example Track Title",
  artist: "Example Artist",
  duration: 205,
  path: "/media/library/track1.flac",
  thumbnail: placeholderThumb,
}

const mediaFolderPath = "/media/library"
const t = (key: string) => key

function pipelineState(
  overrides?: Partial<RowSubtitlePipelineState>,
): RowSubtitlePipelineState {
  return {
    ...getRowSubtitlePipelineState(
      baseRow,
      mediaFolderPath,
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Map([[baseRow.path, true]]),
      new Map([[baseRow.path, true]]),
      true,
    ),
    ...overrides,
  }
}

function rowSubtitleUi(
  isMultiSelectMode: boolean,
  isSelected: boolean,
  stateOverrides?: Partial<RowSubtitlePipelineState>,
) {
  return buildRowSubtitleUi(
    baseRow,
    pipelineState(stateOverrides),
    isMultiSelectMode,
    isSelected,
    true,
    true,
    true,
    true,
    t,
  )
}

const subtitleActions = {
  onTranscribe: action("onTranscribe"),
  onTranscribeStop: action("onTranscribeStop"),
  onTranslate: action("onTranslate"),
  onTranslateStop: action("onTranslateStop"),
  onSynthesize: action("onSynthesize"),
  onSynthesizeStop: action("onSynthesizeStop"),
  onProcess: action("onProcess"),
  onProcessStop: action("onProcessStop"),
}

const fileMenu = {
  onOpen: action("onOpen"),
  onDelete: action("onDelete"),
  onProperties: action("onProperties"),
  onFormatConvert: action("onFormatConvert"),
  onEditTags: action("onEditTags"),
}

const meta = {
  title: "Components/UILocalFileTableRow",
  component: UILocalFileTableRow,
  decorators: [
    (Story) => (
      <div className="w-[720px] rounded-md border bg-card p-4">
        <Table className="w-full table-fixed text-xs">
          <TableBody>
            <Story />
          </TableBody>
        </Table>
      </div>
    ),
  ],
  args: {
    row: baseRow,
    mediaFolderPath,
    isSelected: false,
    selection: {
      isMultiSelectMode: false,
      selectedTrackIds: [],
      onSelectedTrackIdsChange: action("onSelectedTrackIdsChange"),
    },
    subtitleUi: rowSubtitleUi(false, false),
    subtitleActions,
    fileMenu,
    onTrackClick: action("onTrackClick"),
  },
} satisfies Meta<typeof UILocalFileTableRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = {
  args: {
    isSelected: true,
    selection: {
      isMultiSelectMode: false,
      selectedTrackIds: [baseRow.id],
    },
    subtitleUi: rowSubtitleUi(false, true),
  },
}

export const TranscribeRunning: Story = {
  args: {
    subtitleUi: rowSubtitleUi(false, false, { transcribeStatus: "running" }),
  },
}

export const TranscribeFailed: Story = {
  args: {
    subtitleUi: rowSubtitleUi(false, false, { transcribeStatus: "failed" }),
  },
}

export const TranslateRunning: Story = {
  args: {
    subtitleUi: rowSubtitleUi(false, false, { translateStatus: "running" }),
  },
}

export const SynthesizeRunning: Story = {
  args: {
    subtitleUi: rowSubtitleUi(false, false, { synthesizeStatus: "running" }),
  },
}

export const ProcessRunning: Story = {
  args: {
    subtitleUi: rowSubtitleUi(false, false, { processStatus: "running" }),
  },
}

export const MultiSelectMode: Story = {
  args: {
    selection: {
      isMultiSelectMode: true,
      selectedTrackIds: [],
      onSelectedTrackIdsChange: action("onSelectedTrackIdsChange"),
    },
    subtitleUi: rowSubtitleUi(true, false),
  },
}

export const NoThumbnail: Story = {
  args: {
    row: { ...baseRow, thumbnail: undefined },
  },
}
