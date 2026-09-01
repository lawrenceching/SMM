import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act, cleanup } from "@testing-library/react"
import { UI_AskForVideoCompression } from "@/types/eventTypes"

let lastProps: Record<string, unknown> | undefined
let featureEnabled = true

vi.mock("@/components/dialogs", () => ({
  VideoCompressionDialog: (props: Record<string, unknown>) => {
    lastProps = props
    return <div data-testid="video-compression-dialog-stub" />
  },
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: () => ({ filePickerDialog: [vi.fn(), vi.fn()] }),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: () => ({ isVideoCompressionEnabled: featureEnabled }),
}))

import { VideoCompression } from "./VideoCompression"

function ask(detail: { filePath?: string; title?: string; duration?: number }): void {
  document.dispatchEvent(new CustomEvent(UI_AskForVideoCompression, { detail }))
}

describe("VideoCompression (top-level, event-driven)", () => {
  beforeEach(() => {
    cleanup()
    lastProps = undefined
    featureEnabled = true
  })

  it("opens the dialog with the context carried by UI_AskForVideoCompression", () => {
    render(<VideoCompression />)

    act(() => {
      ask({ filePath: "/media/movie.mkv", title: "My Movie", duration: 5400 })
    })

    expect(lastProps?.isOpen).toBe(true)
    expect(lastProps?.filePath).toBe("/media/movie.mkv")
    expect(lastProps?.title).toBe("My Movie")
    expect(lastProps?.duration).toBe(5400)
  })

  it("opens the dialog without a source file (empty-state 'select a file' mode)", () => {
    render(<VideoCompression />)

    act(() => {
      ask({})
    })

    expect(lastProps?.isOpen).toBe(true)
    expect(lastProps?.filePath).toBeUndefined()
  })

  it("ignores requests while the videoCompression feature is disabled", () => {
    featureEnabled = false
    render(<VideoCompression />)

    act(() => {
      ask({ filePath: "/media/movie.mkv" })
    })

    expect(lastProps?.isOpen).toBe(false)
  })

  it("unsubscribes from the event on unmount", () => {
    const { unmount } = render(<VideoCompression />)
    unmount()
    lastProps = undefined

    act(() => {
      ask({ filePath: "/media/movie.mkv" })
    })

    expect(lastProps).toBeUndefined()
  })
})
