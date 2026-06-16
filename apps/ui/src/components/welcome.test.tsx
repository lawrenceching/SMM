import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const h = vi.hoisted(() => ({
  mockOpenDownloadVideo: vi.fn(),
  mockOpenFormatConverter: vi.fn(),
  mockUseFeatures: vi.fn(),
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: () => ({
    downloadVideoDialog: [h.mockOpenDownloadVideo, vi.fn()],
    formatConverterDialog: [h.mockOpenFormatConverter, vi.fn()],
  }),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: () => h.mockUseFeatures(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

import Welcome from "./welcome"

const defaultFeatureFlags = {
  isDisplayFeatureCardsInWelcomeEnabled: true,
  isDownloadVideoEnabled: true,
  isFormatConverterEnabled: true,
}

describe("Welcome", () => {
  beforeEach(() => {
    h.mockOpenDownloadVideo.mockReset()
    h.mockOpenFormatConverter.mockReset()
    h.mockUseFeatures.mockReset()
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)
  })

  it("renders 4 feature cards by default (feature flag on)", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    expect(screen.getByTestId("welcome-card-import-folder")).toBeTruthy()
    expect(screen.getByTestId("welcome-card-download-video")).toBeTruthy()
    expect(screen.getByTestId("welcome-card-format-conversion")).toBeTruthy()
    expect(screen.getByTestId("welcome-card-github")).toBeTruthy()
  })

  it("uses i18n keys for card labels", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    expect(
      screen.getByText("welcome.featureCards.importFolder"),
    ).toBeTruthy()
    expect(
      screen.getByText("welcome.featureCards.downloadVideo"),
    ).toBeTruthy()
    expect(
      screen.getByText("welcome.featureCards.formatConversion"),
    ).toBeTruthy()
    expect(
      screen.getByText("welcome.featureCards.github"),
    ).toBeTruthy()
  })

  it("invokes the onImportFolderClick prop when Import Folder card is clicked", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)
    const onImportFolderClick = vi.fn()

    render(<Welcome onImportFolderClick={onImportFolderClick} />)

    fireEvent.click(screen.getByTestId("welcome-card-import-folder"))

    expect(onImportFolderClick).toHaveBeenCalledTimes(1)
  })

  it("invokes openDownloadVideo dialog when Download Video card is clicked", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    fireEvent.click(screen.getByTestId("welcome-card-download-video"))

    expect(h.mockOpenDownloadVideo).toHaveBeenCalledTimes(1)
  })

  it("invokes openFormatConverter dialog when Format Conversion card is clicked", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    fireEvent.click(screen.getByTestId("welcome-card-format-conversion"))

    expect(h.mockOpenFormatConverter).toHaveBeenCalledTimes(1)
  })

  it("hides download and format conversion cards when HarmonyOS feature flags are off", () => {
    h.mockUseFeatures.mockReturnValue({
      ...defaultFeatureFlags,
      isDownloadVideoEnabled: false,
      isFormatConverterEnabled: false,
    })

    render(<Welcome />)

    expect(screen.getByTestId("welcome-card-import-folder")).toBeTruthy()
    expect(screen.queryByTestId("welcome-card-download-video")).toBeNull()
    expect(screen.queryByTestId("welcome-card-format-conversion")).toBeNull()
    expect(screen.getByTestId("welcome-card-github")).toBeTruthy()
  })

  it("renders the minimal Simple Media Manager view when the feature flag is off", () => {
    h.mockUseFeatures.mockReturnValue({
      ...defaultFeatureFlags,
      isDisplayFeatureCardsInWelcomeEnabled: false,
    })

    render(<Welcome />)

    expect(screen.queryByTestId("welcome-card-import-folder")).toBeNull()
    expect(screen.queryByTestId("welcome-card-download-video")).toBeNull()
    expect(screen.queryByTestId("welcome-card-format-conversion")).toBeNull()
    expect(screen.queryByTestId("welcome-card-github")).toBeNull()

    expect(screen.getByText("Simple Media Manager")).toBeTruthy()
    expect(
      screen.getByText("A simple media manager powered by AI."),
    ).toBeTruthy()
  })

  it("renders the Github card as an external link", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    const githubCard = screen.getByTestId("welcome-card-github")
    expect(githubCard.tagName).toBe("A")
    expect(githubCard.getAttribute("href")).toBe(
      "https://github.com/lawrenceching/SMM",
    )
    expect(githubCard.getAttribute("target")).toBe("_blank")
    expect(githubCard.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("renders the header (Simple Media Manager) in feature cards view", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    // h1 header
    const headings = screen.getAllByText("Simple Media Manager")
    expect(headings.length).toBeGreaterThan(0)
  })

  it("does NOT render the GitCode footer link in feature cards view", () => {
    h.mockUseFeatures.mockReturnValue(defaultFeatureFlags)

    render(<Welcome />)

    expect(screen.queryByText("GitCode")).toBeNull()
  })

  it("renders the GitCode link in the minimal fallback view", () => {
    h.mockUseFeatures.mockReturnValue({
      ...defaultFeatureFlags,
      isDisplayFeatureCardsInWelcomeEnabled: false,
    })

    render(<Welcome />)

    const gitcodeLink = screen.getByText("GitCode").closest("a")
    expect(gitcodeLink?.getAttribute("href")).toBe(
      "https://gitcode.com/lawrenceching/SMM",
    )
  })
})
