import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act, cleanup } from "@testing-library/react"
import { UI_AskForRenameFile } from "@/types/eventTypes"

let lastProps: Record<string, unknown> | undefined

vi.mock("@/components/dialogs", () => ({
  RenameFileDialog: (props: Record<string, unknown>) => {
    lastProps = props
    return <div data-testid="rename-file-dialog-stub" />
  },
}))

import { RenameFile } from "./RenameFile"

function ask(
  onConfirm: (newName: string) => void,
  options?: { initialValue?: string; title?: string },
): void {
  document.dispatchEvent(new CustomEvent(UI_AskForRenameFile, { detail: { onConfirm, options } }))
}

describe("RenameFile (top-level, event-driven)", () => {
  beforeEach(() => {
    cleanup()
    lastProps = undefined
  })

  it("opens the dialog with the requested options", () => {
    const onConfirm = vi.fn()
    render(<RenameFile />)

    act(() => {
      ask(onConfirm, { initialValue: "S01E01.mkv", title: "Rename file" })
    })

    expect(lastProps?.isOpen).toBe(true)
    expect(lastProps?.initialValue).toBe("S01E01.mkv")
    expect(lastProps?.title).toBe("Rename file")
  })

  it("routes the confirmed name back to the requester and closes", () => {
    const onConfirm = vi.fn()
    render(<RenameFile />)

    act(() => {
      ask(onConfirm)
    })
    const dialogConfirm = lastProps?.onConfirm as (newName: string) => void

    act(() => {
      dialogConfirm("S01E02.mkv")
    })

    expect(onConfirm).toHaveBeenCalledWith("S01E02.mkv")
    expect(lastProps?.isOpen).toBe(false)
  })

  it("ignores requests without an onConfirm callback", () => {
    render(<RenameFile />)

    act(() => {
      document.dispatchEvent(new CustomEvent(UI_AskForRenameFile, { detail: {} }))
    })

    expect(lastProps?.isOpen).toBe(false)
  })
})
