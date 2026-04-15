import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { RenameFileDialog } from "./rename-file-dialog"

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

describe("RenameFileDialog", () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderDialog(override: Partial<ComponentProps<typeof RenameFileDialog>> = {}) {
    return render(
      <RenameFileDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue="Old"
        {...override}
      />
    )
  }

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
