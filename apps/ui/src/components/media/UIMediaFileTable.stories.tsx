import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import {
  UIMediaFileTable,
  type UIMediaFileDataRow,
  type UIMediaFileDividerRow,
  type UIMediaFileFolderRow,
  type UIMediaFileTableContextMenuConfig,
  type UIMediaFileTableRow,
} from "./UIMediaFileTable"

// ------------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------------

const mediaFolderPath = "/media/movies/Inception (2010)"

const posterRow: UIMediaFileFolderRow = {
  type: "folderFile",
  id: "poster",
  path: `${mediaFolderPath}/poster.jpg`,
}

const fanartRow: UIMediaFileFolderRow = {
  type: "folderFile",
  id: "fanart",
  path: `${mediaFolderPath}/fanart.jpg`,
}

const nfoRow: UIMediaFileFolderRow = {
  type: "folderFile",
  id: "nfo",
  path: `${mediaFolderPath}/movie.nfo`,
}

const movieDivider: UIMediaFileDividerRow = {
  type: "divider",
  id: "movie",
  text: "Movie",
}

const movieRow: UIMediaFileDataRow = {
  type: "episode",
  season: 1,
  episode: 1,
  videoFile: `${mediaFolderPath}/Inception (2010).mkv`,
  thumbnail: `${mediaFolderPath}/Inception (2010)-thumb.jpg`,
  subtitle: `${mediaFolderPath}/Inception (2010).en.srt`,
  nfo: `${mediaFolderPath}/Inception (2010).nfo`,
  episodeTitle: "Inception",
  checked: false,
}

// TV show fixtures
const season1Divider: UIMediaFileDividerRow = {
  type: "divider",
  id: "season-1",
  text: "Season 1",
}

const season1Ep1: UIMediaFileDataRow = {
  type: "episode",
  season: 1,
  episode: 1,
  videoFile: `${mediaFolderPath}/S01E01.mkv`,
  thumbnail: `${mediaFolderPath}/S01E01-thumb.jpg`,
  subtitle: `${mediaFolderPath}/S01E01.srt`,
  nfo: `${mediaFolderPath}/S01E01.nfo`,
  episodeTitle: "Pilot",
  checked: true,
}

const season1Ep2: UIMediaFileDataRow = {
  type: "episode",
  season: 1,
  episode: 2,
  videoFile: `${mediaFolderPath}/S01E02.mkv`,
  thumbnail: `${mediaFolderPath}/S01E02-thumb.jpg`,
  subtitle: undefined,
  nfo: `${mediaFolderPath}/S01E02.nfo`,
  episodeTitle: "Episode 2",
  checked: false,
}

const season1Ep3: UIMediaFileDataRow = {
  type: "episode",
  season: 1,
  episode: 3,
  videoFile: `${mediaFolderPath}/S01E03.mkv`,
  thumbnail: undefined,
  subtitle: `${mediaFolderPath}/S01E03.srt`,
  nfo: undefined,
  episodeTitle: "Episode 3",
  checked: false,
  disabled: true, // Inactive in current plan
}

const season2Divider: UIMediaFileDividerRow = {
  type: "divider",
  id: "season-2",
  text: "Season 2",
}

const season2Ep1: UIMediaFileDataRow = {
  type: "episode",
  season: 2,
  episode: 1,
  videoFile: `${mediaFolderPath}/S02E01.mkv`,
  thumbnail: `${mediaFolderPath}/S02E01-thumb.jpg`,
  subtitle: `${mediaFolderPath}/S02E01.srt`,
  nfo: `${mediaFolderPath}/S02E01.nfo`,
  episodeTitle: "Season Premiere",
  checked: true,
}

// ------------------------------------------------------------------------
// Context menu configurations
// ------------------------------------------------------------------------

const emptyContextMenu: UIMediaFileTableContextMenuConfig = {}

const dataRowMenuWithOpenOnly: UIMediaFileTableContextMenuConfig = {
  dataRowItems: [
    {
      id: "open",
      label: "Open video file",
      onClick: action("dataRow:open"),
      disabled: (row) => !row.videoFile,
    },
  ],
}

const dataRowMenuFull: UIMediaFileTableContextMenuConfig = {
  dataRowItems: [
    {
      id: "open",
      label: "Open",
      onClick: action("dataRow:open"),
      disabled: (row) => !row.videoFile,
    },
    {
      id: "rename",
      label: "Rename",
      onClick: action("dataRow:rename"),
      disabled: (row) => !row.videoFile,
    },
    {
      id: "select-file",
      label: "Select File…",
      onClick: action("dataRow:selectFile"),
      disabled: (row) => !row.videoFile,
    },
    {
      id: "unlink",
      label: "Unlink",
      onClick: action("dataRow:unlink"),
      disabled: (row) => !row.videoFile,
    },
    {
      id: "video-compress",
      label: "Video Compression",
      onClick: action("dataRow:videoCompress"),
      disabled: (row) => !row.videoFile,
    },
  ],
}

const dataRowMenuMovie: UIMediaFileTableContextMenuConfig = {
  dataRowItems: [
    {
      id: "video-compress",
      label: "Video Compression",
      onClick: action("dataRow:videoCompress"),
      disabled: (row) => !row.videoFile,
    },
  ],
  // folderFileRowItems intentionally absent — MoviePanel does not need menu on poster/fanart
}

const folderFileRowMenuWithOpen: UIMediaFileTableContextMenuConfig = {
  folderFileRowItems: [
    {
      id: "open",
      label: "Open in system viewer",
      onClick: action("folderFile:open"),
    },
  ],
}

// ------------------------------------------------------------------------
// Meta
// ------------------------------------------------------------------------

const meta = {
  title: "Components/UIMediaFileTable",
  component: UIMediaFileTable,
  decorators: [
    (Story) => (
      <div className="w-[900px] rounded-md border bg-card">
        <Story />
      </div>
    ),
  ],
  args: {
    data: [posterRow, fanartRow, nfoRow, movieDivider, movieRow],
    mediaFolderPath,
    contextMenuConfig: emptyContextMenu,
    layout: "simple",
  },
} satisfies Meta<typeof UIMediaFileTable>

export default meta
type Story = StoryObj<typeof meta>

// ------------------------------------------------------------------------
// Default — movie-like data, simple layout, no menu
// ------------------------------------------------------------------------

export const Default: Story = {}

// ------------------------------------------------------------------------
// All three layouts side-by-side comparison
// ------------------------------------------------------------------------

const movieData: UIMediaFileTableRow[] = [posterRow, movieDivider, movieRow]

export const LayoutSimple: Story = {
  args: {
    data: movieData,
    layout: "simple",
  },
}

export const LayoutDetail: Story = {
  args: {
    data: movieData,
    layout: "detail",
  },
}

export const LayoutPreview: Story = {
  args: {
    data: movieData,
    layout: "preview",
  },
}

// ------------------------------------------------------------------------
// Folder file rows: poster, fanart, nfo
// ------------------------------------------------------------------------

export const WithFolderFiles: Story = {
  args: {
    data: [posterRow, fanartRow, nfoRow, movieDivider, movieRow],
  },
}

export const WithFolderFileContextMenu: Story = {
  args: {
    data: [posterRow, fanartRow, nfoRow, movieDivider, movieRow],
    contextMenuConfig: folderFileRowMenuWithOpen,
  },
}

// ------------------------------------------------------------------------
// TV-show-like: multiple seasons with collapsible dividers
// ------------------------------------------------------------------------

const tvShowData: UIMediaFileTableRow[] = [
  season1Divider,
  season1Ep1,
  season1Ep2,
  season1Ep3,
  season2Divider,
  season2Ep1,
]

export const TvShowMultiSeason: Story = {
  args: {
    data: tvShowData,
  },
}

export const TvShowMultiSeasonDetail: Story = {
  args: {
    data: tvShowData,
    layout: "detail",
  },
}

// ------------------------------------------------------------------------
// Data row context menus
// ------------------------------------------------------------------------

export const DataRowMenuSingleItem: Story = {
  args: {
    data: [posterRow, movieDivider, movieRow],
    contextMenuConfig: dataRowMenuWithOpenOnly,
  },
}

export const DataRowMenuFull: Story = {
  args: {
    data: tvShowData,
    contextMenuConfig: dataRowMenuFull,
  },
}

export const DataRowMenuMovieMinimal: Story = {
  args: {
    data: [posterRow, fanartRow, movieDivider, movieRow],
    contextMenuConfig: dataRowMenuMovie,
  },
}

// ------------------------------------------------------------------------
// Disabled items
// ------------------------------------------------------------------------

const dataRowMenuWithDisabledItem: UIMediaFileTableContextMenuConfig = {
  dataRowItems: [
    {
      id: "open",
      label: "Open (disabled in this story)",
      onClick: action("dataRow:open"),
      disabled: true, // Always disabled
    },
    {
      id: "rename",
      label: "Rename",
      onClick: action("dataRow:rename"),
    },
  ],
}

export const DataRowMenuStaticDisabled: Story = {
  args: {
    data: [posterRow, movieDivider, movieRow],
    contextMenuConfig: dataRowMenuWithDisabledItem,
  },
}

export const DataRowMenuConditionalDisabled: Story = {
  args: {
    data: [season1Ep1, season1Ep2, season1Ep3], // ep3 has disabled: true
    contextMenuConfig: {
      dataRowItems: [
        {
          id: "rename",
          label: "Rename (skipped for disabled rows)",
          onClick: action("dataRow:rename"),
          disabled: (row) => row.disabled === true,
        },
      ],
    },
  },
}

// ------------------------------------------------------------------------
// Preview mode (rename / recognize)
// ------------------------------------------------------------------------

export const RenamePreview: Story = {
  args: {
    data: [
      season1Divider,
      {
        ...season1Ep1,
        newVideoFile: `${mediaFolderPath}/Show - S01E01 - Pilot.mkv`,
        newSubtitle: `${mediaFolderPath}/Show - S01E01 - Pilot.en.srt`,
      },
      {
        ...season1Ep2,
        newVideoFile: `${mediaFolderPath}/Show - S01E02 - Episode 2.mkv`,
      },
    ],
    preview: "rename",
  },
}

export const RenamePreviewPartialFilesRename: Story = {
  args: {
    data: [
      season1Divider,
      {
        ...season1Ep1,
        newVideoFile: `${mediaFolderPath}/Show - S01E01 - Pilot.mkv`,
        checked: true,
      },
      {
        ...season1Ep2,
        checked: false,
        disabled: true,
      },
    ],
    preview: "rename",
  },
}

export const RenamePreviewWithCheckboxes: Story = {
  args: {
    data: [
      season1Divider,
      season1Ep1,
      season1Ep2,
      season1Ep3, // disabled — should be greyed out
    ],
    preview: "rename",
    onCheck: action("onCheck"),
  },
}

export const RenamePreviewUnchangedPath: Story = {
  args: {
    data: [
      season1Divider,
      {
        ...season1Ep1,
        // newVideoFile matches videoFile → no strikethrough (already named correctly)
        newVideoFile: season1Ep1.videoFile,
      },
    ],
    preview: "rename",
  },
}

export const RenamePreviewRemoved: Story = {
  args: {
    data: [
      season1Divider,
      {
        ...season1Ep1,
        // checked + no newVideoFile → row will be removed (strikethrough in simple layout)
        newVideoFile: undefined,
      },
    ],
    preview: "rename",
  },
}

export const RecognizePreviewLoading: Story = {
  args: {
    data: [
      season1Divider,
      { ...season1Ep1, videoFile: undefined },
      { ...season1Ep2, videoFile: undefined },
    ],
    preview: "recognize",
    previewStatus: "loading",
  },
}

export const RecognizePreviewOk: Story = {
  args: {
    data: [
      season1Divider,
      { ...season1Ep1, videoFile: undefined },
      { ...season1Ep2, videoFile: undefined },
    ],
    preview: "recognize",
    previewStatus: "ok",
  },
}

// ------------------------------------------------------------------------
// Column visibility (header right-click menu) — Storybook
// ------------------------------------------------------------------------

const columnToggleData: UIMediaFileTableRow[] = [
  season1Divider,
  season1Ep1,
  season1Ep2,
]

export const ColumnVisibilityToggleable: Story = {
  args: {
    data: columnToggleData,
  },
  decorators: [
    (Story) => (
      <div className="w-[900px] rounded-md border bg-card">
        <p className="px-3 py-2 text-xs text-muted-foreground border-b">
          Right-click the table header row to toggle columns.
        </p>
        <Story />
      </div>
    ),
  ],
}

// ------------------------------------------------------------------------
// Edge cases
// ------------------------------------------------------------------------

export const AllRowsComplete: Story = {
  args: {
    data: [
      season1Divider,
      {
        ...season1Ep1,
        thumbnail: undefined,
        subtitle: undefined,
        nfo: undefined,
      },
    ],
  },
}

export const DividerOnly: Story = {
  args: {
    data: [season1Divider],
  },
}

export const NoMediaFolderPath: Story = {
  args: {
    data: [season1Divider, season1Ep1, season1Ep2],
    mediaFolderPath: undefined,
  },
}

export const DisabledRow: Story = {
  args: {
    data: [season1Divider, season1Ep1, season1Ep3], // ep3 is disabled
  },
}
