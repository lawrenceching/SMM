import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { MetadataFiles } from "@smm/types/MetadataFiles"
import { MediaFileTableDetailLayout } from "./MediaFileTableDetailLayout"
import type {
  MediaFileTableLayoutState,
  MediaFileTableSeasonData,
  UIMediaFileTableProps,
} from "./UIMediaFileTable"

const translations: Record<string, string> = {
  "mediaFileTable.columns.id": "ID",
  "mediaFileTable.header.videoFile": "Video File",
  "mediaFileTable.header.thumb": "Thumb",
  "mediaFileTable.header.sub": "Sub",
  "mediaFileTable.header.nfo": "NFO",
  "mediaFileTable.renameCheckboxTitle": "Include in rename",
  "mediaFileTable.expand": "Expand season",
  "mediaFileTable.collapse": "Collapse season",
}

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, _options?: Record<string, unknown>) =>
      translations[key] ?? key,
  }),
}))

// UIThumbnailImage mounts <Image>; stub so jsdom does not load file:// URLs.
vi.mock("@/components/Image", () => ({
  default: () => <div data-testid="thumbnail-image" />,
}))

const mediaFolderPath = "/media/tv/Breaking Bad (2008)"

const episodePath = (episode: number, title: string) =>
  `${mediaFolderPath}/Breaking Bad - S01E${String(episode).padStart(2, "0")} - ${title}.mkv`

const season1: MediaFileTableSeasonData = {
  season: 1,
  title: "Season 1",
  episodes: [
    { season: 1, episode: 1, title: "Pilot", path: episodePath(1, "Pilot") },
    {
      season: 1,
      episode: 2,
      title: "Cat's in the Bag...",
      path: episodePath(2, "Cat's in the Bag"),
    },
  ],
}

const metadataFiles: MetadataFiles = {
  nfoPath: `${mediaFolderPath}/tvshow.nfo`,
  posterPath: `${mediaFolderPath}/poster.jpg`,
  fanartPath: `${mediaFolderPath}/fanart.jpg`,
  seasonPosters: [],
  clearlogoPath: undefined,
  themePath: undefined,
}

const subtitleFiles = [
  {
    season: 1,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot.en.srt`],
  },
]

const nfoFiles = [
  {
    season: 1,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot.nfo`],
  },
]

const thumbnailFiles = [
  {
    season: 1,
    episode: 1,
    files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot-thumb.jpg`],
  },
]

interface LayoutProps extends UIMediaFileTableProps {
  tableState: MediaFileTableLayoutState
}

function renderLayout(
  props: Partial<UIMediaFileTableProps> & {
    tableState?: Pick<
      MediaFileTableLayoutState,
      "collapsedIds" | "episodeContextMenuItems"
    >
  } = {},
) {
  const { tableState, ...rest } = props
  const baseProps: LayoutProps = {
    data: [],
    seasonData: [season1],
    metadataFiles,
    mediaFolderPath,
    subtitleFiles,
    nfoFiles,
    thumbnailFiles,
    checboxVisible: false,
    ...rest,
    tableState: {
      collapsedIds: tableState?.collapsedIds ?? new Set(),
      episodeContextMenuItems: tableState?.episodeContextMenuItems ?? [],
      setSectionCollapsed: vi.fn(),
    },
  }
  return render(<MediaFileTableDetailLayout {...baseProps} />)
}

function getEpisodeRow(id: string): HTMLTableRowElement {
  const cell = screen.getByText(id)
  return cell.closest("tr") as HTMLTableRowElement
}

function getCheckIconCountInRow(row: HTMLTableRowElement): number {
  return row.querySelectorAll(".text-emerald-600").length
}

describe("MediaFileTableDetailLayout", () => {
  it("renders a cover image in the Thumb column when thumbnailFiles lists the episode", () => {
    renderLayout()

    const s1e1Row = getEpisodeRow("S01E01")
    expect(within(s1e1Row).getByTestId("thumbnail-image")).toBeInTheDocument()

    // Episode without a thumbnail entry shows "-" instead of an image.
    const s1e2Row = getEpisodeRow("S01E02")
    expect(within(s1e2Row).queryByTestId("thumbnail-image")).not.toBeInTheDocument()
    expect(within(s1e2Row).getByText("-")).toBeInTheDocument()
  })

  it("shows subtitle and nfo presence icons from subtitleFiles / nfoFiles", () => {
    renderLayout()

    // S01E01 has subtitle + nfo → two check icons (thumb is an image, not a check).
    expect(getCheckIconCountInRow(getEpisodeRow("S01E01"))).toBe(2)
    expect(getCheckIconCountInRow(getEpisodeRow("S01E02"))).toBe(0)
  })
})
