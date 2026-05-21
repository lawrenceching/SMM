import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import { Table, TableBody } from "@/components/ui/table"
import { LocalFileTableRow } from "./LocalFileTableRow"
import type { LocalFileTableRowData } from "./MusicFileTable"

const placeholderThumb = "https://picsum.photos/seed/smm-music-row/112/64"

const baseRow: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  title: "Example Track Title",
  artist: "Example Artist",
  duration: 205,
  path: "/media/library/track1.flac",
  thumbnail: placeholderThumb,
  canTranslate: true,
  canSynthesize: true,
  canProcess: true,
}

const callbackArgs = {
  onTrackClick: action("onTrackClick"),
  onTrackTranscribe: action("onTrackTranscribe"),
  onTranscribeStop: action("onTranscribeStop"),
  onTrackTranslate: action("onTrackTranslate"),
  onTranslateStop: action("onTranslateStop"),
  onTrackSynthesize: action("onTrackSynthesize"),
  onSynthesizeStop: action("onSynthesizeStop"),
  onTrackProcess: action("onTrackProcess"),
  onProcessStop: action("onProcessStop"),
  onSelectedTrackIdsChange: action("onSelectedTrackIdsChange"),
  onTrackOpen: action("onTrackOpen"),
  onTrackDelete: action("onTrackDelete"),
  onTrackProperties: action("onTrackProperties"),
  onTrackFormatConvert: action("onTrackFormatConvert"),
  onTrackEditTags: action("onTrackEditTags"),
}

const meta = {
  title: "Components/LocalFileTableRow",
  component: LocalFileTableRow,
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
    mediaFolderPath: "/media/library",
    isMultiSelectMode: false,
    selectedTrackIds: [],
    isTranscribeAvailable: true,
    isTranslateAvailable: true,
    isSynthesizeAvailable: true,
    isProcessAvailable: true,
    ...callbackArgs,
  },
} satisfies Meta<typeof LocalFileTableRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = {
  args: {
    selectedTrackIds: [baseRow.id],
  },
}

export const TranscribeRunning: Story = {
  args: {
    row: { ...baseRow, transcribeStatus: "running" },
  },
}

export const TranscribeFailed: Story = {
  args: {
    row: { ...baseRow, transcribeStatus: "failed" },
  },
}

export const TranslateRunning: Story = {
  args: {
    row: { ...baseRow, translateStatus: "running" },
  },
}

export const TranslateFailed: Story = {
  args: {
    row: { ...baseRow, translateStatus: "failed" },
  },
}

export const SynthesizeRunning: Story = {
  args: {
    row: { ...baseRow, synthesizeStatus: "running" },
  },
}

export const SynthesizeFailed: Story = {
  args: {
    row: { ...baseRow, synthesizeStatus: "failed" },
  },
}

export const ProcessRunning: Story = {
  args: {
    row: { ...baseRow, processStatus: "running" },
  },
}

export const ProcessFailed: Story = {
  args: {
    row: { ...baseRow, processStatus: "failed" },
  },
}

export const MultiSelectMode: Story = {
  args: {
    isMultiSelectMode: true,
    selectedTrackIds: [],
  },
}

export const NoThumbnail: Story = {
  args: {
    row: { ...baseRow, thumbnail: undefined },
  },
}
