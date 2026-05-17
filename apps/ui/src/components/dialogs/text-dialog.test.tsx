import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TextDialog } from "./text-dialog"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) => {
      if (options?.ns === "common") {
        return key === "cancel" ? "Cancel" : key === "confirm" ? "Confirm" : key
      }
      return key
    },
  }),
}))

describe("TextDialog", () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("confirms with edited text", () => {
    render(
      <TextDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue="initial"
      />,
    )
    const input = screen.getByTestId("text-dialog-input")
    fireEvent.change(input, { target: { value: "updated cookies" } })
    fireEvent.click(screen.getByTestId("text-dialog-confirm"))
    expect(onConfirm).toHaveBeenCalledWith("updated cookies")
    expect(onClose).toHaveBeenCalled()
  })

  it("cancels without calling onConfirm", () => {
    render(
      <TextDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue="keep"
      />,
    )
    fireEvent.change(screen.getByTestId("text-dialog-input"), {
      target: { value: "discard" },
    })
    fireEvent.click(screen.getByTestId("text-dialog-cancel"))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
