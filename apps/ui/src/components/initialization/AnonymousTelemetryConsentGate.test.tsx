/** @vitest-environment jsdom */
import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AnonymousTelemetryConsentGate } from "./AnonymousTelemetryConsentGate"

const setAndSaveUserConfig = vi.fn(async () => {})

const mockUseConfig = vi.fn()

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe("AnonymousTelemetryConsentGate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not open dialog while userConfig is loading", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: [] },
      isLoading: true,
      isUserConfigLoaded: false,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    expect(screen.queryByTestId("anonymous-telemetry-consent-dialog")).not.toBeInTheDocument()
  })

  it("opens dialog when consent is undefined after load", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: [], anonymousTelemetryConsent: undefined },
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    expect(screen.getByTestId("anonymous-telemetry-consent-dialog")).toBeInTheDocument()
  })

  it("does not open dialog when consent is already true", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: [], anonymousTelemetryConsent: true },
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    expect(screen.queryByTestId("anonymous-telemetry-consent-dialog")).not.toBeInTheDocument()
  })

  it("persists true on Agree", async () => {
    const userConfig = { folders: [], anonymousTelemetryConsent: undefined as boolean | undefined }
    mockUseConfig.mockReturnValue({
      userConfig,
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-agree"))
    await waitFor(() => {
      expect(setAndSaveUserConfig).toHaveBeenCalled()
    })
    const [, saved] = setAndSaveUserConfig.mock.calls[0]!
    expect(saved.anonymousTelemetryConsent).toBe(true)
  })

  it("persists false on Disagree", async () => {
    const userConfig = { folders: [], anonymousTelemetryConsent: undefined as boolean | undefined }
    mockUseConfig.mockReturnValue({
      userConfig,
      isLoading: false,
      isUserConfigLoaded: true,
      setAndSaveUserConfig,
    })
    render(<AnonymousTelemetryConsentGate />)
    fireEvent.click(screen.getByTestId("anonymous-telemetry-consent-disagree"))
    await waitFor(() => {
      expect(setAndSaveUserConfig).toHaveBeenCalled()
    })
    const [, saved] = setAndSaveUserConfig.mock.calls[0]!
    expect(saved.anonymousTelemetryConsent).toBe(false)
  })
})
