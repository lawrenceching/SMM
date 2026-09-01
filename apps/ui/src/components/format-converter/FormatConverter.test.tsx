import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act, cleanup } from "@testing-library/react"
import { UI_AskForFormatConverter } from "@/types/eventTypes"

let lastProps: Record<string, unknown> | undefined
let featureEnabled = true

vi.mock("@/components/dialogs", () => ({
  FormatConverterDialog: (props: Record<string, unknown>) => {
    lastProps = props
    return <div data-testid="format-converter-dialog-stub" />
  },
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: () => ({ filePickerDialog: [vi.fn(), vi.fn()] }),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: () => ({ isFormatConverterEnabled: featureEnabled }),
}))

import { FormatConverter } from "./FormatConverter"

function ask(detail: { filePath?: string; title?: string }): void {
  document.dispatchEvent(new CustomEvent(UI_AskForFormatConverter, { detail }))
}

describe("FormatConverter (top-level, event-driven)", () => {
  beforeEach(() => {
    cleanup()
    lastProps = undefined
    featureEnabled = true
  })

  it("opens the dialog with a normalized track for the requested file path", () => {
    render(<FormatConverter />)

    act(() => {
      ask({ filePath: "/media/show/S01E01.mkv", title: "Pilot" })
    })

    expect(lastProps?.isOpen).toBe(true)
    const track = lastProps?.track as { filePath?: string; path?: string; title?: string }
    expect(track?.filePath).toBe("/media/show/S01E01.mkv")
    expect(track?.path).toBe("/media/show/S01E01.mkv")
    expect(track?.title).toBe("Pilot")
  })

  it("opens the dialog in select-a-file mode when no path is provided", () => {
    render(<FormatConverter />)

    act(() => {
      ask({})
    })

    expect(lastProps?.isOpen).toBe(true)
    expect(lastProps?.track).toBeUndefined()
  })

  it("ignores requests while the formatConverter feature is disabled", () => {
    featureEnabled = false
    render(<FormatConverter />)

    act(() => {
      ask({ filePath: "/media/show/S01E01.mkv" })
    })

    expect(lastProps?.isOpen).toBe(false)
  })
})
