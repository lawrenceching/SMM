import { describe, expect, it } from "vitest";
import { doHello } from "./hello.ts";

describe("doHello", () => {
  const options = {
    version: "1.3.8",
    userDataDir: "/home/user/.config/smm",
    appDataDir: "/home/user/.local/share/smm",
    logDir: "/home/user/.local/share/smm/logs",
    tmpDir: "/tmp/smm",
    reverseProxyUrl: "http://127.0.0.1:30001",
    osLocale: "zh-CN",
  };

  it("returns uptime >= 0", () => {
    const result = doHello(options);
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it("forwards all options fields untouched", () => {
    const result = doHello(options);
    expect(result.version).toBe(options.version);
    expect(result.userDataDir).toBe(options.userDataDir);
    expect(result.appDataDir).toBe(options.appDataDir);
    expect(result.logDir).toBe(options.logDir);
    expect(result.tmpDir).toBe(options.tmpDir);
    expect(result.reverseProxyUrl).toBe(options.reverseProxyUrl);
    expect(result.osLocale).toBe(options.osLocale);
  });
});
