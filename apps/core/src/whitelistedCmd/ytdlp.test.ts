import { describe, expect, it } from "vitest";
import { buildYtdlpDownloadArgs } from "./ytdlp";

describe("buildYtdlpDownloadArgs", () => {
  const base = {
    url: "https://www.youtube.com/watch?v=abc",
    folder: "C:/Downloads",
  };

  it("includes --cookies when cookiesFile is set", () => {
    const args = buildYtdlpDownloadArgs({
      ...base,
      cookiesFile: "C:/Users/me/AppData/temp/ytdlp-cookies-job-1.txt",
    });
    const cookiesIdx = args.indexOf("--cookies");
    expect(cookiesIdx).toBeGreaterThanOrEqual(0);
    expect(args[cookiesIdx + 1]).toBe("C:/Users/me/AppData/temp/ytdlp-cookies-job-1.txt");
    expect(args).toContain(base.url);
  });

  it("omits --cookies when cookiesFile is empty", () => {
    const args = buildYtdlpDownloadArgs({ ...base, cookiesFile: "   " });
    expect(args).not.toContain("--cookies");
  });

  it("includes -f and --cookies together", () => {
    const args = buildYtdlpDownloadArgs({
      ...base,
      format: "bestaudio/best",
      cookiesFile: "/data/cookies.txt",
    });
    expect(args).toContain("-f");
    expect(args).toContain("bestaudio/best");
    expect(args).toContain("--cookies");
    expect(args).toContain("/data/cookies.txt");
  });

  it("includes --cookies-from-browser when set", () => {
    const args = buildYtdlpDownloadArgs({
      ...base,
      cookiesFromBrowser: "chrome",
    });
    const idx = args.indexOf("--cookies-from-browser");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe("chrome");
    expect(args).not.toContain("--cookies");
  });

  it("omits --cookies-from-browser for unknown browser", () => {
    const args = buildYtdlpDownloadArgs({
      ...base,
      cookiesFromBrowser: "safari",
    });
    expect(args).not.toContain("--cookies-from-browser");
  });

  it("includes --proxy when proxy is set", () => {
    const args = buildYtdlpDownloadArgs({
      ...base,
      proxy: "socks5://127.0.0.1:1080/",
    });
    const idx = args.indexOf("--proxy");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe("socks5://127.0.0.1:1080/");
    expect(args).toContain(base.url);
  });

  it("omits --proxy when proxy is empty or whitespace", () => {
    const args = buildYtdlpDownloadArgs({ ...base, proxy: "   " });
    expect(args).not.toContain("--proxy");
  });

  it("places --proxy before URL", () => {
    const args = buildYtdlpDownloadArgs({
      ...base,
      proxy: "http://127.0.0.1:8080",
    });
    const proxyIdx = args.indexOf("--proxy");
    const urlIdx = args.indexOf(base.url);
    expect(proxyIdx).toBeGreaterThanOrEqual(0);
    expect(urlIdx).toBeGreaterThanOrEqual(0);
    expect(proxyIdx).toBeLessThan(urlIdx);
  });
});
