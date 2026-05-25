/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralSettings } from "./GeneralSettings";

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

vi.mock("@/lib/i18n", () => ({
  SUPPORTED_APP_LANGUAGES: [{ code: "en", name: "English" }],
  changeLanguage: vi.fn(),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("GeneralSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the general settings page", () => {
    render(<GeneralSettings />);
    expect(screen.getByTestId("general-settings")).toBeInTheDocument();
  });

  it("renders the theme selector", () => {
    render(<GeneralSettings />);
    expect(screen.getByTestId("setting-theme-trigger")).toBeInTheDocument();
  });

  it("renders MCP server settings", () => {
    render(<GeneralSettings />);
    expect(screen.getByTestId("setting-enable-mcp-server")).toBeInTheDocument();
    expect(screen.getByTestId("setting-mcp-host")).toBeInTheDocument();
    expect(screen.getByTestId("setting-mcp-port")).toBeInTheDocument();
  });

  it("renders TMDB settings", () => {
    render(<GeneralSettings />);
    expect(screen.getByTestId("setting-tmdb-host")).toBeInTheDocument();
    expect(screen.getByTestId("setting-tmdb-api-key")).toBeInTheDocument();
  });
});
