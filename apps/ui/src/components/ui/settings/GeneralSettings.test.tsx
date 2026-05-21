/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GeneralSettings } from "./GeneralSettings";

const h = vi.hoisted(() => ({
  fetchDiscoverExecutables: vi.fn(),
  getYtdlpVersion: vi.fn(),
  getFfmpegVersion: vi.fn(),
  discoverVideoCaptioner: vi.fn(),
}));

const defaultUserConfig = {
  applicationLanguage: "en",
  tmdb: {},
  folders: [],
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "",
};

const mockUseConfig = vi.fn(() => ({
  userConfig: defaultUserConfig,
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

vi.mock("@/api/discoverExecutables", () => ({
  fetchDiscoverExecutables: h.fetchDiscoverExecutables,
}));

vi.mock("@/api/ytdlp", () => ({
  getYtdlpVersion: h.getYtdlpVersion,
}));

vi.mock("@/api/ffmpeg", () => ({
  getFfmpegVersion: h.getFfmpegVersion,
}));

vi.mock("@/api/videocaptioner", () => ({
  discoverVideoCaptioner: h.discoverVideoCaptioner,
}));

describe("GeneralSettings VideoCaptioner path display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete defaultUserConfig.ffmpegExecutablePath;
    delete defaultUserConfig.ytdlpExecutablePath;
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
    });
    h.getYtdlpVersion.mockResolvedValue({});
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

  it("shows app-discovered yt-dlp path as placeholder with empty value", async () => {
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: {
        configuredPath: null,
        discoveredPath: "/app/Resources/bin/yt-dlp/yt-dlp",
      },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
    });
    render(<GeneralSettings />);
    const input = await screen.findByTestId("setting-ytdlp-executable-path");
    expect((input as HTMLInputElement).value).toBe("");
    expect((input as HTMLInputElement).placeholder).toBe(
      "/app/Resources/bin/yt-dlp/yt-dlp",
    );
    expect(screen.getByTestId("setting-ytdlp-path-hint")).toHaveTextContent(
      "general.executablePathHintAppDiscovery",
    );
  });

  it("shows user-configured ffmpeg path as input value", async () => {
    defaultUserConfig.ffmpegExecutablePath = "/custom/ffmpeg";
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: {
        configuredPath: "/custom/ffmpeg",
        discoveredPath: "/app/Resources/bin/ffmpeg/ffmpeg",
      },
      videocaptioner: { configuredPath: null, discoveredPath: null },
    });
    render(<GeneralSettings />);
    const input = await screen.findByTestId("setting-ffmpeg-executable-path");
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("/custom/ffmpeg");
    });
    expect(screen.getByTestId("setting-ffmpeg-path-hint")).toHaveTextContent(
      "general.executablePathHintUserConfig",
    );
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
