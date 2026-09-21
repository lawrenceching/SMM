/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiAgentSettings } from "./AiAgentSettings";
import { AI_AGENT_PERMISSIONS } from "@smm/types";

const defaultUserConfig = {
  tmdb: {},
  tvdb: {},
  folders: [],
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "",
  aiAgent: { permissions: [] as string[] },
};

const mockSetAndSaveUserConfig = vi.fn();

const mockUseConfig = vi.fn(() => ({
  userConfig: defaultUserConfig,
  patchUserConfig: mockSetAndSaveUserConfig,
}));

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/utils", () => ({
  nextTraceId: () => "test-trace-id",
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

describe("AiAgentSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockImplementation(() => ({
      userConfig: defaultUserConfig,
      patchUserConfig: mockSetAndSaveUserConfig,
    }));
  });

  it("renders the AI agent settings page", () => {
    render(<AiAgentSettings />);
    expect(screen.getByTestId("ai-agent-settings")).toBeInTheDocument();
  });

  it("checkbox is unchecked when no permissions are granted", () => {
    render(<AiAgentSettings />);
    expect(
      screen.getByTestId("setting-ai-agent-metadata-write"),
    ).not.toBeChecked();
  });

  it("checkbox is checked when metadata.write is granted", () => {
    mockUseConfig.mockReturnValue({
      userConfig: {
        ...defaultUserConfig,
        aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
      },
      patchUserConfig: mockSetAndSaveUserConfig,
    });
    render(<AiAgentSettings />);
    expect(screen.getByTestId("setting-ai-agent-metadata-write")).toBeChecked();
  });

  it("hides save button until something changes", () => {
    render(<AiAgentSettings />);
    expect(screen.queryByTestId("settings-save-button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("setting-ai-agent-metadata-write"));

    expect(screen.getByTestId("settings-save-button")).toBeInTheDocument();
  });

  it("saves metadata.write permission when checked and saved", async () => {
    render(<AiAgentSettings />);
    fireEvent.click(screen.getByTestId("setting-ai-agent-metadata-write"));
    fireEvent.click(screen.getByTestId("settings-save-button"));

    expect(mockSetAndSaveUserConfig).toHaveBeenCalledTimes(1);
    const [traceId, patch] = mockSetAndSaveUserConfig.mock.calls[0];
    expect(traceId).toContain("AiAgentSettings");
    expect(patch).toEqual([
      {
        op: "add",
        path: "/aiAgent",
        value: { permissions: ["metadata.write"] },
      },
    ]);
  });

  it("saves empty permissions when unchecked and saved", async () => {
    mockUseConfig.mockReturnValue({
      userConfig: {
        ...defaultUserConfig,
        aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
      },
      patchUserConfig: mockSetAndSaveUserConfig,
    });
    render(<AiAgentSettings />);
    fireEvent.click(screen.getByTestId("setting-ai-agent-metadata-write"));
    fireEvent.click(screen.getByTestId("settings-save-button"));

    const [, patch] = mockSetAndSaveUserConfig.mock.calls[0];
    expect(patch).toEqual([
      {
        op: "add",
        path: "/aiAgent",
        value: { permissions: [] },
      },
    ]);
  });
});
