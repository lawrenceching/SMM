import { describe, expect, it } from "vitest";
import { buildYtdlpInspectArgs } from "./ytdlp";

describe("buildYtdlpInspectArgs", () => {
  it("builds -J with cookies and proxy", () => {
    const args = buildYtdlpInspectArgs({
      url: "https://www.youtube.com/watch?v=abc",
      cookiesFile: "/data/temp/ytdlp-cookies-x.txt",
      proxy: "http://127.0.0.1:8080",
    });
    expect(args).toContain("--cookies");
    expect(args).toContain("/data/temp/ytdlp-cookies-x.txt");
    expect(args).toContain("--proxy");
    expect(args).toContain("-J");
    expect(args.at(-1)).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("supports flat-playlist json mode", () => {
    const args = buildYtdlpInspectArgs({
      url: "https://example.com/list",
      mode: "flat-playlist-json",
    });
    expect(args).toContain("--flat-playlist");
    expect(args).toContain("-J");
  });
});
