import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import { useState } from "react"
import {
  UIMediaFileTable,
  type MediaFileTableSeasonData,
  type UIMediaEpisodeSelection,
  type UIMediaFileTableProps,
} from "./UIMediaFileTable"
import type { MetadataFiles } from "@smm/types/MetadataFiles"

// ------------------------------------------------------------------------
// Fixtures (seasonData-driven path used by TvShowPanel)
// ------------------------------------------------------------------------

const mediaFolderPath = "/media/tv/Breaking Bad (2008)"

const episodePath = (season: number, episode: number, title: string) =>
  `${mediaFolderPath}/Breaking Bad - S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")} - ${title}.mkv`

const season1: MediaFileTableSeasonData = {
  season: 1,
  title: "Season 1",
  episodes: [
    { season: 1, episode: 1, title: "Pilot", path: episodePath(1, 1, "Pilot") },
    {
      season: 1,
      episode: 2,
      title: "Cat's in the Bag...",
      path: episodePath(1, 2, "Cat's in the Bag"),
    },
    {
      season: 1,
      episode: 3,
      title: "...And the Bag's in the River",
      path: episodePath(1, 3, "And the Bag's in the River"),
    },
    {
      season: 1,
      episode: 4,
      title: "Cancer Man",
      // No video file linked → checkbox is disabled (default behavior).
      path: undefined,
    },
  ],
}

const season2: MediaFileTableSeasonData = {
  season: 2,
  title: "Season 2",
  episodes: [
    {
      season: 2,
      episode: 1,
      title: "Seven Thirty-Seven",
      path: episodePath(2, 1, "Seven Thirty-Seven"),
    },
    {
      season: 2,
      episode: 2,
      title: "Grilled",
      path: episodePath(2, 2, "Grilled"),
    },
  ],
}

const seasonData: MediaFileTableSeasonData[] = [season1, season2]

const metadataFiles: MetadataFiles = {
  nfoPath: `${mediaFolderPath}/tvshow.nfo`,
  posterPath: `${mediaFolderPath}/poster.jpg`,
  fanartPath: `${mediaFolderPath}/fanart.jpg`,
  clearlogoPath: `${mediaFolderPath}/clearlogo.png`,
  themePath: `${mediaFolderPath}/theme.mp3`,
  seasonPosters: [
    { season: 1, path: `${mediaFolderPath}/Season01.jpg` },
    { season: 2, path: `${mediaFolderPath}/Season02.jpg` },
  ],
}

const subtitleFiles = [
  {
    season: 1,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot.en.srt`],
  },
  {
    season: 1,
    episode: 3,
    files: [`${mediaFolderPath}/Breaking Bad - S01E03 - And the Bag's in the River.zh.srt`],
  },
  {
    season: 2,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S02E01 - Seven Thirty-Seven.en.srt`],
  },
]

const nfoFiles = [
  {
    season: 1,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot.nfo`],
  },
  {
    season: 2,
    episode: 2,
    files: [`${mediaFolderPath}/Breaking Bad - S02E02 - Grilled.nfo`],
  },
]

const thumbnailFiles = [
  {
    season: 1,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot-thumb.jpg`],
  },
  {
    season: 2,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S02E01 - Seven Thirty-Seven-thumb.jpg`],
  },
]

const defaultContextMenuProps = {
  onOpenMenuClick: action("menu:open"),
  onPropertiesMenuClick: action("menu:properties"),
  renameMenuVisible: true,
  onRenameMenuClick: action("menu:rename"),
  unlinkMenuVisible: true,
  onUnlinkMenuClick: action("menu:unlink"),
}

// ------------------------------------------------------------------------
// Stateful harness: mirrors TvShowPanel's controlled selection state
// ------------------------------------------------------------------------

const initialChecked: UIMediaEpisodeSelection[] = [{ season: 1, episode: 1 }]

function SeasonDataHarness(props: UIMediaFileTableProps) {
  const [checkedEpisodes, setCheckedEpisodes] = useState<UIMediaEpisodeSelection[]>(initialChecked)

  return (
    <UIMediaFileTable
      {...props}
      selectedEpisodes={checkedEpisodes}
      onCheck={(season, episode, isChecked) => {
        action("onCheck")({ season, episode, isChecked })
        setCheckedEpisodes((prev) => {
          const exists = prev.some(
            (e) => e.season === season && e.episode === episode,
          )
          if (isChecked === exists) return prev
          if (isChecked) return [...prev, { season, episode }]
          return prev.filter((e) => !(e.season === season && e.episode === episode))
        })
      }}
    />
  )
}

// ------------------------------------------------------------------------
// Meta
// ------------------------------------------------------------------------

const meta = {
  title: "Components/UIMediaFileTable/Season Data Layouts",
  component: UIMediaFileTable,
  decorators: [
    (Story) => (
      <div className="w-[900px] rounded-md border bg-card">
        <Story />
      </div>
    ),
  ],
  render: (args) => <SeasonDataHarness {...args} />,
  args: {
    data: [],
    seasonData,
    metadataFiles,
    mediaFolderPath,
    subtitleFiles,
    nfoFiles,
    thumbnailFiles,
    contextMenuProps: defaultContextMenuProps,
    layout: "simple",
    checboxVisible: false,
  },
} satisfies Meta<typeof UIMediaFileTable>

export default meta
type Story = StoryObj<typeof meta>

// ------------------------------------------------------------------------
// Simple layout
// ------------------------------------------------------------------------

export const Simple: Story = {
  args: { layout: "simple" },
}

export const SimpleWithCheckbox: Story = {
  args: {
    layout: "simple",
    checboxVisible: true,
  },
}

// ------------------------------------------------------------------------
// Detail layout
// ------------------------------------------------------------------------

export const Detail: Story = {
  args: { layout: "detail" },
}

export const DetailWithCheckbox: Story = {
  args: {
    layout: "detail",
    checboxVisible: true,
  },
}

// ------------------------------------------------------------------------
// Preview layout
// ------------------------------------------------------------------------

export const Preview: Story = {
  args: { layout: "preview" },
}

export const PreviewWithCheckbox: Story = {
  args: {
    layout: "preview",
    checboxVisible: true,
  },
}
