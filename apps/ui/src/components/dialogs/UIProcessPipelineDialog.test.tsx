/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { UIProcessPipelineDialog } from "./UIProcessPipelineDialog"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe("UIProcessPipelineDialog", () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invokes onConfirm with selected media id when confirm is clicked", () => {
    render(
      <UIProcessPipelineDialog
        isOpen
        onClose={mockOnClose}
        rows={[{ id: "/media/a.mkv", mediaPath: "/media/a.mkv", title: "Ep", eligible: true }]}
        onConfirm={mockOnConfirm}
        videoCaptionerAvailable
        asrOptionsEnabled={false}
      />,
    )

    fireEvent.click(screen.getByTestId("process-pipeline-confirm"))
    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    const payload = mockOnConfirm.mock.calls[0][0]
    expect(payload.selectedIds).toContain("/media/a.mkv")
    expect(payload.asr).toBeDefined()
  })
})
