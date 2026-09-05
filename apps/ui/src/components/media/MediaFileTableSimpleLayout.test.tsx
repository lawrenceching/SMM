import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { MetadataFiles } from "@smm/types/MetadataFiles"
import { MediaFileTableSimpleLayout } from "./MediaFileTableSimpleLayout"
import type {
  MediaFileTableLayoutState,
  MediaFileTableSeasonData,
  UIMediaEpisodeSelection,
  UIMediaFileTableProps,
} from "./UIMediaFileTable"

// Translations used by the layout under test (column headers, checkbox
// spacer, season collapse toggles). The i18n runtime is exercised elsewhere;
// here we return fixed text so assertions read clearly.
const translations: Record<string, string> = {
  "mediaFileTable.columns.id": "ID",
  "mediaFileTable.header.videoFile": "Video",
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

// UIThumbnailImage mounts <Image> inside a HoverCard when a row has a
// thumbnail; it would try to load a file:// URL in jsdom. Stub it out.
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
    {
      season: 1,
      episode: 3,
      title: "Cancer Man",
      // No video file linked.
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
      title: "Grilled",
      path: episodePath(1, "Grilled"),
    },
  ],
}

const metadataFiles: MetadataFiles = {
  nfoPath: `${mediaFolderPath}/tvshow.nfo`,
  posterPath: `${mediaFolderPath}/poster.jpg`,
  fanartPath: `${mediaFolderPath}/fanart.jpg`,
  seasonPosters: [],
  clearlogoPath: `${mediaFolderPath}/clearlogo.png`,
}

const subtitleFiles = [
  { season: 1, episode: 1, files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot.en.srt`] },
]

const nfoFiles = [
  { season: 1, episode: 1, files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot.nfo`] },
]

const thumbnailFiles = [
  { season: 1, episode: 1, files: [`${mediaFolderPath}/Breaking Bad - S01E01 - Pilot-thumb.jpg`] },
]

interface LayoutProps extends UIMediaFileTableProps {
  tableState: MediaFileTableLayoutState
}

function renderLayout({
  checboxVisible,
  selectedEpisodes,
  onCheck,
  newFilePaths,
  tableState,
  ...props
}: Partial<UIMediaFileTableProps> & {
  tableState?: Pick<
    MediaFileTableLayoutState,
    "collapsedIds" | "episodeContextMenuItems"
  >
} = {}) {
  const baseProps: LayoutProps = {
    data: [],
    seasonData: [season1, season2],
    metadataFiles,
    mediaFolderPath,
    subtitleFiles,
    nfoFiles,
    thumbnailFiles,
    checboxVisible: checboxVisible ?? false,
    ...props,
    selectedEpisodes,
    onCheck,
    newFilePaths,
    tableState: {
      collapsedIds: tableState?.collapsedIds ?? new Set(),
      episodeContextMenuItems: tableState?.episodeContextMenuItems ?? [],
      setSectionCollapsed: vi.fn(),
    },
  }
  return render(<MediaFileTableSimpleLayout {...baseProps} />)
}

/** The episode row <tr> that contains the given SxxExx id. */
function getEpisodeRow(id: string): HTMLTableRowElement {
  const cell = screen.getByText(id)
  return cell.closest("tr") as HTMLTableRowElement
}

function getCheckIconCountInRow(row: HTMLTableRowElement): number {
  return row.querySelectorAll(".text-emerald-600").length
}

describe("MediaFileTableSimpleLayout", () => {
  it("renders the column headers without a checkbox column by default", () => {
    renderLayout()

    expect(
      screen.getByRole("columnheader", { name: "ID" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Video" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Thumb" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Sub" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "NFO" }),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  })

  it("adds a checkbox spacer column when checboxVisible is true", () => {
    renderLayout({ checboxVisible: true })

    // One checkbox per episode row (season 1 ×3 + season 2 ×1; the episode
    // without a video file still renders a disabled checkbox).
    expect(screen.getAllByRole("checkbox")).toHaveLength(4)
    expect(screen.getByTitle("Include in rename")).toBeInTheDocument()
  })

  it("renders a name/value row for each metadata file path present", () => {
    renderLayout()

    // Only poster/fanart/nfo/clearlogo were supplied; values are shown
    // relative to mediaFolderPath.
    expect(screen.getByText("poster")).toBeInTheDocument()
    expect(screen.getByText("poster.jpg")).toBeInTheDocument()
    expect(screen.getByText("fanart")).toBeInTheDocument()
    expect(screen.getByText("fanart.jpg")).toBeInTheDocument()
    expect(screen.getByText("nfo")).toBeInTheDocument()
    expect(screen.getByText("tvshow.nfo")).toBeInTheDocument()
    expect(screen.getByText("clearlogo")).toBeInTheDocument()
    expect(screen.getByText("clearlogo.png")).toBeInTheDocument()
    // theme was not provided → no row.
    expect(screen.queryByText("theme")).not.toBeInTheDocument()
  })

  it("renders no metadata rows when no metadata files are present", () => {
    renderLayout({ metadataFiles: undefined })

    expect(screen.queryByText("poster")).not.toBeInTheDocument()
    expect(screen.queryByText("fanart")).not.toBeInTheDocument()
    expect(screen.queryByText("nfo")).not.toBeInTheDocument()
    expect(screen.queryByText("clearlogo")).not.toBeInTheDocument()
    expect(screen.queryByText("theme")).not.toBeInTheDocument()
  })

  it("renders each season heading and episode row with relative video paths", () => {
    renderLayout()

    expect(screen.getByText("Season 1")).toBeInTheDocument()
    expect(screen.getByText("Season 2")).toBeInTheDocument()
    expect(screen.getByText("S01E01")).toBeInTheDocument()
    expect(screen.getByText("S02E01")).toBeInTheDocument()

    const s1e1Row = getEpisodeRow("S01E01")
    expect(within(s1e1Row).getByText("Breaking Bad - S01E01 - Pilot.mkv")).toBeInTheDocument()
    // An episode without a linked video file shows the path cell as "-".
    const s1e3Row = getEpisodeRow("S01E03")
    expect(within(s1e3Row).getByText("-")).toBeInTheDocument()
  })

  it("shows presence indicators for linked thumbnail/subtitle/nfo files", () => {
    renderLayout()

    // S01E01 has a thumbnail, subtitle and nfo → three check icons.
    expect(getCheckIconCountInRow(getEpisodeRow("S01E01"))).toBe(3)
    // S01E02 has none → zero check icons.
    expect(getCheckIconCountInRow(getEpisodeRow("S01E02"))).toBe(0)
  })

  it("fires onCheck with (season, episode, checked) when a row checkbox is toggled", () => {
    const onCheck = vi.fn()
    renderLayout({
      checboxVisible: true,
      onCheck,
      // Checkboxes are only enabled for episodes with a plan target that
      // differs from the current path.
      newFilePaths: [
        {
          season: 1,
          episode: 2,
          newFilePath: `${mediaFolderPath}/Breaking Bad - S01E02 - Cat's in the Bag (renamed).mkv`,
        },
        {
          season: 2,
          episode: 1,
          newFilePath: `${mediaFolderPath}/Breaking Bad - S02E01 - Grilled (renamed).mkv`,
        },
      ],
    })

    const s1e2Row = getEpisodeRow("S01E02")
    fireEvent.click(within(s1e2Row).getByRole("checkbox"))
    expect(onCheck).toHaveBeenCalledWith(1, 2, true)

    const s2e1Row = getEpisodeRow("S02E01")
    fireEvent.click(within(s2e1Row).getByRole("checkbox"))
    expect(onCheck).toHaveBeenCalledWith(2, 1, true)
  })

  it("checks the row checkbox when the episode is in selectedEpisodes", () => {
    const selectedEpisodes: UIMediaEpisodeSelection[] = [
      { season: 1, episode: 1 },
      { season: 2, episode: 1 },
    ]
    renderLayout({
      checboxVisible: true,
      selectedEpisodes,
      // Selected episodes only render as checked while their checkbox is
      // enabled, i.e. while a differing plan target exists.
      newFilePaths: [
        {
          season: 1,
          episode: 1,
          newFilePath: `${mediaFolderPath}/Breaking Bad - S01E01 - Pilot (renamed).mkv`,
        },
        {
          season: 2,
          episode: 1,
          newFilePath: `${mediaFolderPath}/Breaking Bad - S02E01 - Grilled (renamed).mkv`,
        },
      ],
    })

    expect(
      within(getEpisodeRow("S01E01")).getByRole("checkbox"),
    ).toBeChecked()
    expect(
      within(getEpisodeRow("S02E01")).getByRole("checkbox"),
    ).toBeChecked()
    expect(
      within(getEpisodeRow("S01E02")).getByRole("checkbox"),
    ).not.toBeChecked()
  })

  it("renders selected episodes without a plan target as disabled and unchecked", () => {
    const selectedEpisodes: UIMediaEpisodeSelection[] = [{ season: 1, episode: 1 }]
    renderLayout({ checboxVisible: true, selectedEpisodes })

    const checkbox = within(getEpisodeRow("S01E01")).getByRole("checkbox")
    expect(checkbox).toBeDisabled()
    expect(checkbox).not.toBeChecked()
  })

  it("disables checkboxes without a differing plan target and enables them otherwise", () => {
    renderLayout({
      checboxVisible: true,
      newFilePaths: [
        // Target equal to the current path → nothing to apply → disabled.
        { season: 1, episode: 1, newFilePath: episodePath(1, "Pilot") },
        // Differing target → enabled, even for an episode without a video file.
        {
          season: 1,
          episode: 3,
          newFilePath: `${mediaFolderPath}/Breaking Bad - S01E03 - Cancer Man (renamed).mkv`,
        },
      ],
    })

    // No plan target → disabled, regardless of a linked video file.
    expect(
      within(getEpisodeRow("S01E02")).getByRole("checkbox"),
    ).toBeDisabled()
    expect(
      within(getEpisodeRow("S01E01")).getByRole("checkbox"),
    ).toBeDisabled()
    expect(
      within(getEpisodeRow("S01E03")).getByRole("checkbox"),
    ).not.toBeDisabled()
  })

  it("enables the checkbox for a video-less episode when disableCheckboxIfEpisodeVideoNotAvailable is false", () => {
    renderLayout({
      checboxVisible: true,
      disableCheckboxIfEpisodeVideoNotAvailable: false,
    })

    expect(
      within(getEpisodeRow("S01E03")).getByRole("checkbox"),
    ).not.toBeDisabled()
  })

  it("renders the old and new file paths when newFilePaths has a different target", () => {
    const newFilePath = `${mediaFolderPath}/Breaking Bad - S01E01 - Pilot (renamed).mkv`
    renderLayout({
      newFilePaths: [{ season: 1, episode: 1, newFilePath }],
    })

    const s1e1Row = getEpisodeRow("S01E01")
    expect(
      within(s1e1Row).getByTestId("media-file-table-new-video-file"),
    ).toHaveTextContent("Breaking Bad - S01E01 - Pilot (renamed).mkv")
    expect(
      within(s1e1Row).getByTestId("media-file-table-old-video-file"),
    ).toHaveTextContent("Breaking Bad - S01E01 - Pilot.mkv")
  })

  describe("season collapse", () => {
    function CollapseHarness() {
      const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
      const tableState: MediaFileTableLayoutState = {
        collapsedIds,
        setSectionCollapsed: (id, collapsed) =>
          setCollapsedIds((prev) => {
            const next = new Set(prev)
            if (collapsed) next.add(id)
            else next.delete(id)
            return next
          }),
        episodeContextMenuItems: [],
      }
      return (
        <MediaFileTableSimpleLayout
          data={[]}
          seasonData={[season1]}
          mediaFolderPath={mediaFolderPath}
          tableState={tableState}
        />
      )
    }

    it("hides the season's episode rows once collapsed and shows them again when expanded", () => {
      render(<CollapseHarness />)

      expect(screen.getByText("S01E01")).toBeInTheDocument()
      expect(screen.getByText("Breaking Bad - S01E01 - Pilot.mkv")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Collapse season" }))

      expect(screen.getByRole("button", { name: "Expand season" })).toHaveAttribute(
        "aria-expanded",
        "false",
      )
      expect(screen.queryByText("S01E01")).not.toBeInTheDocument()
      // Season heading stays visible while collapsed.
      expect(screen.getByText("Season 1")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Expand season" }))
      expect(screen.getByText("S01E01")).toBeInTheDocument()
    })

    it("starts collapsed when the season id is in tableState.collapsedIds", () => {
      const collapsedIds = new Set(["season-1"])
      const tableState: MediaFileTableLayoutState = {
        collapsedIds,
        setSectionCollapsed: vi.fn(),
        episodeContextMenuItems: [],
      }
      render(
        <MediaFileTableSimpleLayout
          data={[]}
          seasonData={[season1]}
          mediaFolderPath={mediaFolderPath}
          tableState={tableState}
        />,
      )

      expect(screen.getByRole("button", { name: "Expand season" })).toHaveAttribute(
        "aria-expanded",
        "false",
      )
      expect(screen.queryByText("S01E01")).not.toBeInTheDocument()
    })
  })
})
