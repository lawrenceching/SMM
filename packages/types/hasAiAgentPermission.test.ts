import { describe, expect, it } from "vitest";
import {
  AI_AGENT_PERMISSIONS,
  hasAiAgentPermission,
  type UserConfig,
} from "./types";

function configWith(permissions: string[] | undefined): UserConfig {
  return { aiAgent: { permissions } } as unknown as UserConfig;
}

describe("hasAiAgentPermission", () => {
  it("returns false for undefined config", () => {
    expect(
      hasAiAgentPermission(undefined, AI_AGENT_PERMISSIONS.metadataWrite),
    ).toBe(false);
  });

  it("returns false when aiAgent is missing", () => {
    expect(
      hasAiAgentPermission({} as UserConfig, AI_AGENT_PERMISSIONS.metadataWrite),
    ).toBe(false);
  });

  it("returns false when permissions are missing", () => {
    expect(
      hasAiAgentPermission(
        configWith(undefined),
        AI_AGENT_PERMISSIONS.metadataWrite,
      ),
    ).toBe(false);
  });

  it("returns false when permissions are empty", () => {
    expect(
      hasAiAgentPermission(
        configWith([]),
        AI_AGENT_PERMISSIONS.metadataWrite,
      ),
    ).toBe(false);
  });

  it("returns true when the permission is granted", () => {
    expect(
      hasAiAgentPermission(
        configWith([AI_AGENT_PERMISSIONS.metadataWrite]),
        AI_AGENT_PERMISSIONS.metadataWrite,
      ),
    ).toBe(true);
  });
});
