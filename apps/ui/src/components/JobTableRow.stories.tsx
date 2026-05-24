import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import { JobTableRow } from "./JobTableRow"
import type { JobTableRowData } from "./MusicFileTable"

const baseRow: JobTableRowData = {
  kind: "job",
  id: 1,
  index: 0,
  jobId: "job-1",
  status: "pending",
  title: "Example Download Title",
  artist: "Example Artist",
  duration: 0,
}

const callbackArgs = {
  onDownloadStart: action("onDownloadStart"),
  onDownloadStop: action("onDownloadStop"),
  onDownloadRemove: action("onDownloadRemove"),
  onSelectedTrackIdsChange: action("onSelectedTrackIdsChange"),
}

const meta = {
  title: "Components/JobTableRow",
  component: JobTableRow,
  decorators: [
    (Story) => (
      <div className="w-[720px] rounded-md border bg-card p-4">
        <div
          role="table"
          style={{
            display: "grid",
            gridTemplateColumns: "40px 64px 1fr 128px 64px 32px",
          }}
          className="w-full text-xs"
        >
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    row: baseRow,
    mediaFolderPath: "/media/library",
    isMultiSelectMode: false,
    selectedTrackIds: [],
    hasRunningDownload: false,
    ...callbackArgs,
  },
} satisfies Meta<typeof JobTableRow>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = {}

export const Downloading: Story = {
  args: {
    row: { ...baseRow, status: "downloading" },
  },
}

export const Completed: Story = {
  args: {
    row: { ...baseRow, status: "completed" },
  },
}

export const Failed: Story = {
  args: {
    row: { ...baseRow, status: "failed" },
  },
}

export const Stopped: Story = {
  args: {
    row: { ...baseRow, status: "stopped" },
  },
}

export const MultiSelectMode: Story = {
  args: {
    isMultiSelectMode: true,
    selectedTrackIds: [],
  },
}
