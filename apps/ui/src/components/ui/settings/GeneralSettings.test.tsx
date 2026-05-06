/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GeneralSettings } from "./GeneralSettings";

const h = vi.hoisted(() => ({
  discoverYtdlp: vi.fn(),
  getYtdlpVersion: vi.fn(),
  discoverFfmpeg: vi.fn(),
  getFfmpegVersion: vi.fn(),
  discoverVideoCaptioner: vi.fn(),
}));

const mockUseConfig = vi.fn(() => ({
  userConfig: {
    applicationLanguage: "en",
    tmdb: {},
    folders: [],
    renameRules: [],
    dryRun: false,
    selectedRenameRule: "",
  },
  setAndSaveUserConfig: vi.fn(),
}));

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}));

vi.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: () => ({
    filePickerDialog: [vi.fn(), vi.fn()],
  }),
}));

vi.mock("@/lib/i18n", () => ({
  SUPPORTED_APP_LANGUAGES: [{ code: "en", name: "English" }],
  changeLanguage: vi.fn(),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/api/ytdlp", () => ({
  discoverYtdlp: h.discoverYtdlp,
  getYtdlpVersion: h.getYtdlpVersion,
}));

vi.mock("@/api/ffmpeg", () => ({
  discoverFfmpeg: h.discoverFfmpeg,
  getFfmpegVersion: h.getFfmpegVersion,
}));

vi.mock("@/api/videocaptioner", () => ({
  discoverVideoCaptioner: h.discoverVideoCaptioner,
}));

describe("GeneralSettings VideoCaptioner path display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.discoverYtdlp.mockResolvedValue({});
    h.getYtdlpVersion.mockResolvedValue({});
    h.discoverFfmpeg.mockResolvedValue({});
    h.getFfmpegVersion.mockResolvedValue({});
  });

  it("shows discovered videocaptioner path", async () => {
    h.discoverVideoCaptioner.mockResolvedValue({ path: "/c/Users/lawrence/AppData/Local/Programs/Python/Python310/Scripts/videocaptioner.exe" });
    render(<GeneralSettings />);
    await waitFor(() => {
      expect(screen.getByTestId("setting-videocaptioner-path")).toHaveTextContent("videocaptioner.exe");
    });
  });

  it("shows unavailable state when path missing", async () => {
    h.discoverVideoCaptioner.mockResolvedValue({ error: "videocaptioner not found" });
    render(<GeneralSettings />);
    await waitFor(() => {
      expect(screen.getByTestId("setting-videocaptioner-path")).toHaveTextContent("general.videoCaptionerExecutablePathUnavailable");
    });
  });

  it("defaults useBundledFfmpegForVideoCaptioner to checked when config field is missing", async () => {
    h.discoverVideoCaptioner.mockResolvedValue({ error: "videocaptioner not found" });
    mockUseConfig.mockReturnValueOnce({
      userConfig: {
        applicationLanguage: "en",
        tmdb: {},
        folders: [],
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "",
      },
      setAndSaveUserConfig: vi.fn(),
    });

    render(<GeneralSettings />);

    const checkbox = await screen.findByTestId("setting-use-bundled-ffmpeg-videocaptioner");
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });
});
