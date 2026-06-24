import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { OpenFolderDialog } from "./open-folder-dialog"
import { useFeatures } from "@/hooks/useFeatures"
import { useConfig } from "@/hooks/userConfig"

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "openFolder.title": "Select Folder Type",
        "openFolder.description": "Choose the type of media folder you want to open",
        "openFolder.folderPathLabel": "Folder Path",
        "openFolder.types.tvshow.label": "Tv Show / Anime",
        "openFolder.types.tvshow.description": "For television series and anime",
        "openFolder.types.movie.label": "Movie",
        "openFolder.types.movie.description": "For movies and films",
        "openFolder.types.music.label": "Video/Music",
        "openFolder.types.music.description": "For video and music files",
      }
      return labels[key] ?? key
    },
  }),
}))

describe("OpenFolderDialog", () => {
  const onClose = vi.fn()
  const onSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useConfig).mockReturnValue({
      userConfig: { folders: [] },
    } as ReturnType<typeof useConfig>)
  })

  it("shows all folder types when music import is enabled", () => {
    vi.mocked(useFeatures).mockReturnValue({
      isMusicFolderImportEnabled: true,
    } as ReturnType<typeof useFeatures>)

    render(
      <OpenFolderDialog
        isOpen
        onClose={onClose}
        onSelect={onSelect}
        folderPath="/media/shows"
      />,
    )

    expect(screen.getByText("Tv Show / Anime")).toBeInTheDocument()
    expect(screen.getByText("Movie")).toBeInTheDocument()
    expect(screen.getByText("Video/Music")).toBeInTheDocument()
  })

  it("hides music folder type when music import is disabled", () => {
    vi.mocked(useFeatures).mockReturnValue({
      isMusicFolderImportEnabled: false,
    } as ReturnType<typeof useFeatures>)

    render(
      <OpenFolderDialog
        isOpen
        onClose={onClose}
        onSelect={onSelect}
        folderPath="/media/shows"
      />,
    )

    expect(screen.getByText("Tv Show / Anime")).toBeInTheDocument()
    expect(screen.getByText("Movie")).toBeInTheDocument()
    expect(screen.queryByText("Video/Music")).not.toBeInTheDocument()
  })
})
