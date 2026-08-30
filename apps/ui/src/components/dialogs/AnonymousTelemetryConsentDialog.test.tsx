/** @vitest-environment jsdom */
import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AnonymousTelemetryConsentDialog } from "./AnonymousTelemetryConsentDialog"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe("AnonymousTelemetryConsentDialog", () => {
  const onAgree = vi.fn()
  const onDisagree = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders title and actions when open", () => {
    render(
      <AnonymousTelemetryConsentDialog
        isOpen={true}
        onAgree={onAgree}
        onDisagree={onDisagree}
      />,
    )
    expect(screen.getByTestId("anonymous-telemetry-consent-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("anonymous-telemetry-consent-agree")).toBeInTheDocument()
    expect(screen.getByTestId("anonymous-telemetry-consent-disagree")).toBeInTheDocument()
  })

  it("calls onAgree when Agree is clicked", () => {
    render(
      <AnonymousTelemetryConsentDialog
        isOpen={true}
        onAgree={onAgree}
        onDisagree={onDisagree}
      />,
    )
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-agree"))
    expect(onAgree).toHaveBeenCalledTimes(1)
    expect(onDisagree).not.toHaveBeenCalled()
  })

  it("calls onDisagree when Disagree is clicked", () => {
    render(
      <AnonymousTelemetryConsentDialog
        isOpen={true}
        onAgree={onAgree}
        onDisagree={onDisagree}
      />,
    )
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-disagree"))
    expect(onDisagree).toHaveBeenCalledTimes(1)
    expect(onAgree).not.toHaveBeenCalled()
  })
})
