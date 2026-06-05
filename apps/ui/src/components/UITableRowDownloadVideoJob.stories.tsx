import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import { UITableRowDownloadVideoJob } from "./UITableRowDownloadVideoJob"
import type { JobTableRowData } from "./MusicFileTable"
import type { YtdlpDownloadProgress } from "@/hooks/useYtdlpDownloadProgressQuery"

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

const t = (key: string) => {
  if (key === "mediaPlayer.downloadingTooltip") return "Downloading"
  if (key === "mediaPlayer.trackContextMenu.downloadStart") return "Start Download"
  if (key === "mediaPlayer.trackContextMenu.downloadStop") return "Stop Download"
  if (key === "mediaPlayer.trackContextMenu.downloadRemove") return "Remove"
  return key
}

function makeProgress(overrides: Partial<YtdlpDownloadProgress>): YtdlpDownloadProgress {
  return {
    percent: 0,
    speedBps: 0,
    etaSeconds: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    status: "downloading",
    updatedAt: Date.now(),
    ...overrides,
  }
}

const meta = {
  title: "Components/UITableRowDownloadVideoJob",
  component: UITableRowDownloadVideoJob,
  decorators: [
    (Story) => (
      <div className="w-[720px] rounded-md border bg-card p-4">
        <div
          role="table"
          style={{
            display: "grid",
            gridTemplateColumns: "40px 64px 1fr 128px 160px 32px",
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
    isSelected: false,
    isMultiSelectMode: false,
    onToggleSelect: action("onToggleSelect"),
    hasRunningDownload: false,
    onDownloadStart: action("onDownloadStart"),
    onDownloadStop: action("onDownloadStop"),
    onDownloadRemove: action("onDownloadRemove"),
    liveProgress: null,
    t,
  },
} satisfies Meta<typeof UITableRowDownloadVideoJob>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = {}

export const DownloadingEarly: Story = {
  args: {
    row: { ...baseRow, status: "downloading" },
    liveProgress: makeProgress({ percent: 5, speedBps: 500_000, etaSeconds: 120 }),
  },
}

export const DownloadingMid: Story = {
  args: {
    row: { ...baseRow, status: "downloading" },
    liveProgress: makeProgress({ percent: 50, speedBps: 9_900_000, etaSeconds: 8 }),
  },
}

export const DownloadingLate: Story = {
  args: {
    row: { ...baseRow, status: "downloading" },
    liveProgress: makeProgress({ percent: 95, speedBps: 2_500_000, etaSeconds: 3 }),
  },
}

export const DownloadingLongEta: Story = {
  args: {
    row: { ...baseRow, status: "downloading" },
    liveProgress: makeProgress({ percent: 22, speedBps: 1_200_000, etaSeconds: 3600 }),
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

export const Selected: Story = {
  args: {
    isSelected: true,
  },
}

export const MultiSelectMode: Story = {
  args: {
    isMultiSelectMode: true,
  },
}

export const HasRunningDownloadPending: Story = {
  args: {
    hasRunningDownload: true,
  },
}
