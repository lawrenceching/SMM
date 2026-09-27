import { describe, expect, it } from "vitest";
import { resolveUserDataDir } from "./userConfig.ts";
import type { CoreRoutesConfig } from "./types.ts";

describe("resolveUserDataDir", () => {
  it("prefers top-level userDataDir over appDataDir (Linux XDG split)", () => {
    const config: CoreRoutesConfig = {
      allowlist: [],
      userDataDir: "/root/.config/smm",
      appDataDir: "/root/.local/share/smm",
    };
    expect(resolveUserDataDir(config)).toBe("/root/.config/smm");
  });

  it("falls back to hello.userDataDir when top-level userDataDir is omitted", () => {
    const config: CoreRoutesConfig = {
      allowlist: [],
      appDataDir: "/root/.local/share/smm",
      hello: {
        version: "1.0.0",
        userDataDir: "/root/.config/smm",
        appDataDir: "/root/.local/share/smm",
        logDir: "/logs",
        tmpDir: "/tmp",
        reverseProxyUrl: null,
        osLocale: "en-US",
        coreRoutesPort: 30000,
      },
    };
    expect(resolveUserDataDir(config)).toBe("/root/.config/smm");
  });

  it("falls back to appDataDir only when userDataDir is not provided", () => {
    const config: CoreRoutesConfig = {
      allowlist: [],
      appDataDir: "/root/.local/share/smm",
    };
    expect(resolveUserDataDir(config)).toBe("/root/.local/share/smm");
  });
});
