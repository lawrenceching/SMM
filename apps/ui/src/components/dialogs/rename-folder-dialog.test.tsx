import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { RenameFolderDialog } from "./rename-folder-dialog"
import type { MediaMetadata } from "@core/types"

const mutation = vi.hoisted(() => ({
  isPending: false,
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
}))

vi.mock("@/hooks/useRenameMediaFolderMutation", () => ({
  useRenameMediaFolderMutation: () => ({
    get isPending() {
      return mutation.isPending
    },
    mutateAsync: mutation.mutateAsync,
    reset: mutation.reset,
  }),
}))

const queryData = vi.hoisted(() => ({
  data: undefined as MediaMetadata | undefined,
}))

vi.mock("@/hooks/mediaMetadata", () => ({
  useMediaMetadataQuery: () => ({
    data: queryData.data,
    isPending: false,
    isFetching: false,
    isError: false,
  }),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) => {
      if (options?.ns === "common") {
        const common: Record<string, string> = { cancel: "Cancel", confirm: "Confirm" }
        return common[key] ?? key
      }
      const dialogs: Record<string, string> = {
        "rename.defaultTitle": "Rename",
        "rename.defaultDescription": "Enter a new name",
        "rename.newNameLabel": "Name",
        "rename.placeholder": "Type here",
        "rename.suggestions": "Suggestions",
      }
      return dialogs[key] ?? key
    },
  }),
}))

describe("RenameFolderDialog", () => {
  const onClose = vi.fn()
  const folderPath = "/media/library/My Show Folder"

  beforeEach(() => {
    vi.clearAllMocks()
    mutation.isPending = false
    mutation.mutateAsync.mockResolvedValue(undefined)
    queryData.data = undefined
  })

  function renderDialog(override: Partial<ComponentProps<typeof RenameFolderDialog>> = {}) {
    return render(
      <RenameFolderDialog
        isOpen
        onClose={onClose}
        mediaFolderPath={folderPath}
        {...override}
      />
    )
  }

  it("uses folder basename as initial input value", () => {
    renderDialog()
    expect(screen.getByTestId("rename-dialog-input")).toHaveValue("My Show Folder")
  })

  it("shows TV suggestions with tmdbid when tvShow.database is TMDB and airDate is set", () => {
    queryData.data = {
      mediaFolderPath: folderPath,
      type: "tvshow-folder",
      tvShow: {
        id: "99",
        name: "Showname",
        database: "TMDB",
        airDate: "2020-01-01",
        seasons: [],
      },
    } as MediaMetadata
    renderDialog()
    expect(screen.getByTestId("rename-dialog-suggestions")).toBeInTheDocument()
    expect(screen.getByTestId("rename-dialog-suggestion-0")).toHaveTextContent(
      /Showname \(2020\) \{tmdbid=99\}/
    )
  })

  it("shows movie suggestions with tmdbid when movie.database is TMDB and airDate is set", () => {
    queryData.data = {
      mediaFolderPath: "/media/library/My Movie Folder",
      type: "movie-folder",
      movie: {
        id: "555",
        name: "Moviename",
        database: "TMDB",
        airDate: "2019-06-01",
      },
    } as MediaMetadata
    renderDialog({ mediaFolderPath: "/media/library/My Movie Folder" })
    expect(screen.getByTestId("rename-dialog-suggestions")).toBeInTheDocument()
    expect(screen.getByTestId("rename-dialog-suggestion-0")).toHaveTextContent(
      /Moviename \(2019\) \{tmdbid=555\}/
    )
  })

  it("calls mutateAsync with path and new name then onClose on successful confirm", async () => {
    renderDialog()
    const input = screen.getByTestId("rename-dialog-input")
    fireEvent.change(input, { target: { value: "Renamed Folder" } })
    fireEvent.click(screen.getByTestId("rename-dialog-confirm"))
    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith({
        mediaFolderPath: folderPath,
        newName: "Renamed Folder",
      })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose when mutateAsync rejects", async () => {
    mutation.mutateAsync.mockRejectedValueOnce(new Error("fail"))
    renderDialog()
    fireEvent.change(screen.getByTestId("rename-dialog-input"), { target: { value: "X" } })
    fireEvent.click(screen.getByTestId("rename-dialog-confirm"))
    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalled()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("disables input, cancel, confirm, and suggestions while mutation is pending", () => {
    mutation.isPending = true
    queryData.data = {
      mediaFolderPath: folderPath,
      type: "tvshow-folder",
      tvShow: {
        id: "1",
        name: "S",
        database: "TMDB",
        airDate: "2020-01-01",
        seasons: [],
      },
    } as MediaMetadata
    renderDialog()

    expect(screen.getByTestId("rename-dialog-input")).toBeDisabled()
    expect(screen.getByTestId("rename-dialog-cancel")).toBeDisabled()
    expect(screen.getByTestId("rename-dialog-confirm")).toBeDisabled()
    expect(screen.getByTestId("rename-dialog-suggestion-0")).toBeDisabled()
  })

  it("resets mutation state via reset when isOpen becomes false", () => {
    const { rerender } = render(
      <RenameFolderDialog isOpen onClose={onClose} mediaFolderPath={folderPath} />
    )
    rerender(
      <RenameFolderDialog isOpen={false} onClose={onClose} mediaFolderPath={folderPath} />
    )
    expect(mutation.reset).toHaveBeenCalled()
  })
})
