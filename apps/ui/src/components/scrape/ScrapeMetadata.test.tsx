import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act, cleanup } from "@testing-library/react"
import type { MediaMetadata } from "@smm/types"
import { UI_AskForScrape } from "@/types/eventTypes"

let lastDialogProps: Record<string, unknown> | undefined
let scrapeInput: { isOpen: boolean; mediaMetadata?: MediaMetadata } | undefined

vi.mock("@/components/dialogs", () => ({
  UIScrapeDialog: (props: Record<string, unknown>) => {
    lastDialogProps = props
    return <div data-testid="scrape-dialog-stub" />
  },
  useScrapeDialog: (input: { isOpen: boolean; mediaMetadata?: MediaMetadata }) => {
    scrapeInput = input
    return {
      tasks: [],
      isRunning: false,
      allTasksDone: false,
      showButtons: true,
      cancelDisabled: false,
      canDismissIncidentally: true,
      handleCancel: vi.fn(),
      handleStart: vi.fn(async () => {}),
    }
  },
}))

import { ScrapeMetadata } from "./ScrapeMetadata"

function ask(mediaMetadata?: MediaMetadata): void {
  document.dispatchEvent(new CustomEvent(UI_AskForScrape, { detail: { mediaMetadata } }))
}

describe("ScrapeMetadata (top-level, event-driven)", () => {
  beforeEach(() => {
    cleanup()
    lastDialogProps = undefined
    scrapeInput = undefined
  })

  it("opens the scrape dialog with the requested media metadata", () => {
    const mediaMetadata = { mediaFolderPath: "/media/show" } as MediaMetadata
    render(<ScrapeMetadata />)

    act(() => {
      ask(mediaMetadata)
    })

    expect(scrapeInput?.isOpen).toBe(true)
    expect(scrapeInput?.mediaMetadata).toBe(mediaMetadata)
    expect(lastDialogProps?.isOpen).toBe(true)
  })

  it("does not open when no request arrives", () => {
    render(<ScrapeMetadata />)

    expect(scrapeInput?.isOpen).toBe(false)
    expect(lastDialogProps?.isOpen).toBe(false)
  })
})
