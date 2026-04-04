import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { RenameDialog } from "./rename-dialog"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

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

const store = vi.hoisted(() => ({
  mediaMetadatas: [] as UIMediaMetadata[],
}))

vi.mock("@/stores/mediaMetadataStore", () => ({
  useMediaMetadataStore: (selector: (s: { mediaMetadatas: UIMediaMetadata[] }) => unknown) =>
    selector({ mediaMetadatas: store.mediaMetadatas }),
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

describe("RenameDialog", () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mutation.isPending = false
    mutation.mutateAsync.mockResolvedValue(undefined)
    store.mediaMetadatas = []
  })

  function renderDialog(override: Partial<ComponentProps<typeof RenameDialog>> = {}) {
    return render(
      <RenameDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue="Old"
        {...override}
      />
    )
  }

  describe("callback mode (no mediaFolderPath)", () => {
    it("shows initialValue in the input", () => {
      renderDialog({ initialValue: "file.txt" })
      expect(screen.getByTestId("rename-dialog-input")).toHaveValue("file.txt")
    })

    it("calls onConfirm with trimmed name and onClose when confirming after edit", async () => {
      renderDialog({ initialValue: "a" })
      const input = screen.getByTestId("rename-dialog-input")
      fireEvent.change(input, { target: { value: "new-name" } })
      fireEvent.click(screen.getByTestId("rename-dialog-confirm"))
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith("new-name")
      })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("disables confirm when value equals initial (unchanged)", () => {
      renderDialog({ initialValue: "same" })
      expect(screen.getByTestId("rename-dialog-confirm")).toBeDisabled()
    })

    it("calls onClose when cancel is clicked", () => {
      renderDialog()
      fireEvent.click(screen.getByTestId("rename-dialog-cancel"))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it("renders suggestion chips from props when provided", () => {
      renderDialog({ suggestions: ["opt-a", "opt-b"] })
      expect(screen.getByTestId("rename-dialog-suggestion-0")).toHaveTextContent("opt-a")
      expect(screen.getByTestId("rename-dialog-suggestion-1")).toHaveTextContent("opt-b")
      fireEvent.click(screen.getByTestId("rename-dialog-suggestion-0"))
      expect(screen.getByTestId("rename-dialog-input")).toHaveValue("opt-a")
    })
  })

  describe("media folder mode (mediaFolderPath)", () => {
    const folderPath = "/media/library/My Show Folder"

    it("uses folder basename as initial input value", () => {
      renderDialog({ mediaFolderPath: folderPath, initialValue: "ignored-for-folder-mode" })
      expect(screen.getByTestId("rename-dialog-input")).toHaveValue("My Show Folder")
    })

    it("shows TV suggestions from store metadata when tvShow has airDate", () => {
      store.mediaMetadatas = [
        {
          mediaFolderPath: folderPath,
          mediaName: "Display",
          status: "ok",
          type: "tvshow-folder",
          tvShow: {
            id: "99",
            name: "Showname",
            database: "TMDB",
            airDate: "2020-01-01",
            seasons: [],
          },
        } as UIMediaMetadata,
      ]
      renderDialog({ mediaFolderPath: folderPath })
      expect(screen.getByTestId("rename-dialog-suggestions")).toBeInTheDocument()
      expect(screen.getByTestId("rename-dialog-suggestion-0")).toHaveTextContent(
        /Showname \(2020\) \{tmdbid=99\}/
      )
    })

    it("calls mutateAsync with path and new name then onClose on successful confirm", async () => {
      renderDialog({ mediaFolderPath: folderPath })
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
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it("does not call onClose when mutateAsync rejects", async () => {
      mutation.mutateAsync.mockRejectedValueOnce(new Error("fail"))
      renderDialog({ mediaFolderPath: folderPath })
      fireEvent.change(screen.getByTestId("rename-dialog-input"), { target: { value: "X" } })
      fireEvent.click(screen.getByTestId("rename-dialog-confirm"))
      await waitFor(() => {
        expect(mutation.mutateAsync).toHaveBeenCalled()
      })
      expect(onClose).not.toHaveBeenCalled()
    })

    it("disables input, cancel, confirm, and suggestions while mutation is pending", () => {
      mutation.isPending = true
      store.mediaMetadatas = [
        {
          mediaFolderPath: folderPath,
          mediaName: "m",
          status: "ok",
          type: "tvshow-folder",
          tvShow: {
            id: "1",
            name: "S",
            database: "TMDB",
            airDate: "2020-01-01",
            seasons: [],
          },
        } as UIMediaMetadata,
      ]
      renderDialog({ mediaFolderPath: folderPath })

      expect(screen.getByTestId("rename-dialog-input")).toBeDisabled()
      expect(screen.getByTestId("rename-dialog-cancel")).toBeDisabled()
      expect(screen.getByTestId("rename-dialog-confirm")).toBeDisabled()
      expect(screen.getByTestId("rename-dialog-suggestion-0")).toBeDisabled()
    })
  })

  describe("when closed", () => {
    it("resets mutation state via reset when isOpen becomes false", () => {
      const { rerender } = render(
        <RenameDialog isOpen onClose={onClose} onConfirm={onConfirm} initialValue="a" />
      )
      rerender(
        <RenameDialog isOpen={false} onClose={onClose} onConfirm={onConfirm} initialValue="a" />
      )
      expect(mutation.reset).toHaveBeenCalled()
    })
  })
})
