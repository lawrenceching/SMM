import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import {
  type UIMediaFileDataContextMenuItem,
  type UIMediaFileDataRow,
  type UIMediaFileDividerRow,
  type UIMediaFileFolderRow,
  type UIMediaFileTableRow,
} from "./UIMediaFileTable"
import { MediaFileTable } from "./MediaFileTable"

const mediaFolderPath = "/media/movies/Inception (2010)"

const posterRow: UIMediaFileFolderRow = {
  id: "poster",
  type: "folderFile",
  path: "poster.jpg",
}

const movieDivider: UIMediaFileDividerRow = {
  id: "movie",
  type: "divider",
  text: "Movie",
}

const movieRow: UIMediaFileDataRow = {
  season: 1,
  episode: 1,
  type: "episode",
  videoFile: "/media/movies/Inception (2010)/Inception.mkv",
  thumbnail: "/media/movies/Inception (2010)/thumb.jpg",
  subtitle: "/media/movies/Inception (2010)/Inception.srt",
  nfo: "/media/movies/Inception (2010)/movie.nfo",
  episodeTitle: "Inception",
  checked: false,
}

const data: UIMediaFileTableRow[] = [posterRow, movieDivider, movieRow]

const meta = {
  title: "Components/MediaFileTable",
  component: MediaFileTable,
  decorators: [
    (Story) => (
      <div className="w-[900px] rounded-md border bg-card">
        <Story />
      </div>
    ),
  ],
  args: {
    data,
    mediaFolderPath,
    layout: "simple",
  },
} satisfies Meta<typeof MediaFileTable>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default — only the built-in "Open" and "Properties" right-click items.
 */
export const Default: Story = {}

/**
 * Caller injects a panel-private "Rename" item via `extraEpisodeContextMenu`.
 * It is appended after the built-in items.
 */
export const WithExtraContextMenu: Story = {
  args: {
    extraEpisodeContextMenu: [
      {
        id: "rename",
        label: "Rename",
        onClick: action("dataRow:rename"),
        disabled: (row) => !row.videoFile,
      },
    ] satisfies UIMediaFileDataContextMenuItem[],
  },
}
