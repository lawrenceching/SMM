import { describe, expect, it } from "vitest";
import { injectYtdlpProgressArgs, parseYtdlpProgressLine } from "./progress";

describe("parseYtdlpProgressLine", () => {
  it("parses a full progress JSON line", () => {
    const line =
      '{"percent": "42.5%", "speed": "1024", "eta": "30", "downloaded": "100", "total": "200", "status": "downloading"}';
    expect(parseYtdlpProgressLine(line)).toEqual({
      percent: 42.5,
      speed: 1024,
      eta: 30,
      downloaded: 100,
      total: 200,
      status: "downloading",
    });
  });

  it("derives percent from downloaded/total when percent is NA", () => {
    const line =
      '{"percent": "NA", "speed": "0", "eta": "NA", "downloaded": "50", "total": "100", "status": "downloading"}';
    const r = parseYtdlpProgressLine(line);
    expect(r?.percent).toBe(50);
    expect(r?.eta).toBeNull();
  });

  it("returns null for non-progress lines", () => {
    expect(parseYtdlpProgressLine("not json")).toBeNull();
    expect(parseYtdlpProgressLine('{"percent":"50"}')).toBeNull();
  });
});

describe("injectYtdlpProgressArgs", () => {
  it("injects for download args that include --output", () => {
    const args = injectYtdlpProgressArgs(["--output", "/tmp/%(title)s.%(ext)s", "https://x"]);
    expect(args).toContain("--newline");
    expect(args).toContain("--progress-template");
  });

  it("skips inspect args without --output", () => {
    const args = injectYtdlpProgressArgs(["-J", "https://x"]);
    expect(args).not.toContain("--newline");
  });
});
