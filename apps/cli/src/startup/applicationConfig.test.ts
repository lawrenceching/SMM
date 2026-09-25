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
  it("flattens hello, HTTP bootstrap, and UI listen fields without nesting", () => {
    const fields = buildApplicationConfigLogFields({
      reverseProxyUrl: "http://127.0.0.1:30002",
      uiPort: 30000,
      uiBind: "127.0.0.1",
      staticRoot: "/ui/dist",
      auth: { enabled: true, token: "secret" },
    });

    expect(fields).toMatchObject({
      version: "9.9.9-test",
      coreRoutesPort: expect.any(Number),
      reverseProxyUrl: "http://127.0.0.1:30002",
      uiPort: 30000,
      uiBind: "127.0.0.1",
      staticRoot: "/ui/dist",
      authEnabled: true,
    });
    expect(fields).not.toHaveProperty("ui");
    expect(fields).not.toHaveProperty("mcp");
    expect(fields).not.toHaveProperty("token");
  });
});
