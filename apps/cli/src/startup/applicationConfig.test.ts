import { describe, expect, it, vi } from "vitest";
import { buildApplicationConfigLogFields } from "./applicationConfig";

vi.mock("@/core/getCore", () => ({
  getCore: () => ({
    hello: () => ({
      uptime: 1,
      version: "9.9.9-test",
      platform: "win32",
      userDataDir: "/cfg",
      appDataDir: "/data",
      tmpDir: "/tmp",
      logDir: "/logs",
      osLocale: "en-US",
    }),
  }),
}));

describe("buildApplicationConfigLogFields", () => {
  it("flattens hello and UI listen fields without reverseProxyUrl or coreRoutesPort", () => {
    const fields = buildApplicationConfigLogFields({
      uiPort: 30000,
      uiBind: "127.0.0.1",
      staticRoot: "/ui/dist",
      auth: { enabled: true, token: "secret" },
    });

    expect(fields).toMatchObject({
      version: "9.9.9-test",
      userDataDir: "/cfg",
      uiPort: 30000,
      uiBind: "127.0.0.1",
      staticRoot: "/ui/dist",
      authEnabled: true,
    });
    expect(fields).not.toHaveProperty("reverseProxyUrl");
    expect(fields).not.toHaveProperty("coreRoutesPort");
    expect(fields).not.toHaveProperty("ui");
    expect(fields).not.toHaveProperty("mcp");
    expect(fields).not.toHaveProperty("token");
  });
});
