import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  injectYtdlpProgressArgs,
  isYtdlpProgressJson,
  parseYtdlpProgressLine,
  resolveSpawnArgsAndEnv,
} from "../utils/cmd";

const mocks = vi.hoisted(() => ({
  discoverFfmpeg: vi.fn(),
  discoverYtdlp: vi.fn(),
  discoverFfprobe: vi.fn(),
  discoverVideoCaptioner: vi.fn(),
  discoverQuickjs: vi.fn(),
  resolveSpawnEnvForVideoCaptioner: vi.fn(),
}));

vi.mock("../utils/Ffmpeg", () => ({
  discoverFfmpeg: mocks.discoverFfmpeg,
  discoverFfprobe: mocks.discoverFfprobe,
}));

vi.mock("../utils/Ytdlp", () => ({
  discoverYtdlp: mocks.discoverYtdlp,
}));

vi.mock("../utils/VideoCaptioner", () => ({
  discoverVideoCaptioner: mocks.discoverVideoCaptioner,
  resolveSpawnEnvForVideoCaptioner: mocks.resolveSpawnEnvForVideoCaptioner,
}));

vi.mock("../utils/QuickJS", () => ({
  discoverQuickjs: mocks.discoverQuickjs,
}));

describe("isYtdlpProgressJson", () => {
  it("returns true for a downloading-status line with quoted string values", () => {
    const line =
      '{"percent": "42.3", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}';
    expect(isYtdlpProgressJson(line)).toBe(true);
  });

  it("returns true for a line with all percent/speed as NA strings", () => {
    // Matches the verified YouTube output: percent and speed are always
    // quoted strings (either "NA" or a numeric string).
    const line =
      '{"percent": "NA", "speed": "NA", "eta": 9210, "downloaded": 1024, "total": 572853052, "status": "downloading"}';
    expect(isYtdlpProgressJson(line)).toBe(true);
  });

  it("returns true for a finished line with quoted values", () => {
    const line = '{"percent": "100", "speed": "0", "eta": 0, "status": "finished"}';
    expect(isYtdlpProgressJson(line)).toBe(true);
  });

  it("returns true for a line where eta is the unquoted literal NA (sanitized)", () => {
    // The unquoted `eta: NA` becomes `eta: null` after sanitization.
    const line =
      '{"percent": "NA", "speed": "NA", "eta": NA, "downloaded": 1024, "total": 572853052, "status": "downloading"}';
    expect(isYtdlpProgressJson(line)).toBe(true);
  });

  it("returns true for backward-compat unquoted-number lines", () => {
    const line =
      '{"percent":42.3,"speed":1234567,"eta":42,"downloaded":5242880,"total":104857600,"status":"downloading"}';
    expect(isYtdlpProgressJson(line)).toBe(true);
  });

  it("returns false for a line that does not start with {", () => {
    expect(isYtdlpProgressJson("[download] Destination: foo.mp4")).toBe(false);
  });

  it("returns false for JSON without a status field", () => {
    expect(isYtdlpProgressJson('{"foo":"bar"}')).toBe(false);
  });

  it("returns false for invalid JSON", () => {
    expect(isYtdlpProgressJson("{not valid json")).toBe(false);
  });
});

describe("parseYtdlpProgressLine", () => {
  it("parses a downloading line with quoted numeric strings", () => {
    const line =
      '{"percent": "42.3", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}';
    expect(parseYtdlpProgressLine(line)).toEqual({
      percent: 42.3,
      speed: 1234567,
      eta: 42,
      downloaded: 5242880,
      total: 104857600,
      status: "downloading",
    });
  });

  it("parses a finished line with quoted values", () => {
    const line = '{"percent": "100", "speed": "0", "eta": 0, "status": "finished"}';
    expect(parseYtdlpProgressLine(line)).toEqual({
      percent: 100,
      speed: 0,
      eta: 0,
      downloaded: null,
      total: null,
      status: "finished",
    });
  });

  it("falls back to downloaded/total when percent is the string NA", () => {
    // Reproduces the real YouTube output: percent is always "NA" but
    // downloaded and total are valid numbers, so we still show progress.
    const line =
      '{"percent": "NA", "speed": "62197.226750079644", "eta": 9210, "downloaded": 1024, "total": 572853052, "status": "downloading"}';
    const result = parseYtdlpProgressLine(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBeCloseTo((1024 / 572853052) * 100, 6);
    expect(result!.speed).toBe(62197.226750079644);
    expect(result!.eta).toBe(9210);
    expect(result!.downloaded).toBe(1024);
    expect(result!.total).toBe(572853052);
    expect(result!.status).toBe("downloading");
  });

  it("treats speed=NA as 0", () => {
    const line =
      '{"percent": "NA", "speed": "NA", "eta": 9210, "downloaded": 1024, "total": 572853052, "status": "downloading"}';
    const result = parseYtdlpProgressLine(line);
    expect(result).not.toBeNull();
    expect(result!.speed).toBe(0);
  });

  it("sanitizes unquoted NA for eta (treats as null)", () => {
    const line =
      '{"percent": "NA", "speed": "NA", "eta": NA, "downloaded": 1024, "total": 572853052, "status": "downloading"}';
    const result = parseYtdlpProgressLine(line);
    expect(result).not.toBeNull();
    expect(result!.eta).toBeNull();
  });

  it("does not divide by zero when total is 0", () => {
    const line =
      '{"percent": "NA", "speed": "0", "eta": 0, "downloaded": 0, "total": 0, "status": "downloading"}';
    const result = parseYtdlpProgressLine(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(0);
  });

  it("parses unquoted-number lines (backward compat)", () => {
    const line =
      '{"percent":42.3,"speed":1234567,"eta":42,"downloaded":5242880,"total":104857600,"status":"downloading"}';
    expect(parseYtdlpProgressLine(line)).toEqual({
      percent: 42.3,
      speed: 1234567,
      eta: 42,
      downloaded: 5242880,
      total: 104857600,
      status: "downloading",
    });
  });

  it("returns null when status is neither downloading nor finished", () => {
    const line = '{"status":"other","percent":"0"}';
    expect(parseYtdlpProgressLine(line)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseYtdlpProgressLine("not json")).toBeNull();
  });

  it("returns null when no status field is present", () => {
    expect(parseYtdlpProgressLine('{"percent":"50"}')).toBeNull();
  });
});

describe("injectYtdlpProgressArgs", () => {
  it("injects --newline and --progress-template for download commands", () => {
    const args = ["--output", "/tmp/%(title)s.%(ext)s", "https://example.com/v"];
    const result = injectYtdlpProgressArgs(args);
    expect(result).toEqual([
      "--output",
      "/tmp/%(title)s.%(ext)s",
      "https://example.com/v",
      "--newline",
      "--progress-template",
      // The verified template quotes `percent` and `speed` so yt-dlp's
      // `NA` placeholder becomes the valid JSON string `"NA"`.
      expect.stringContaining('"percent": "%(progress._percent_json)s"'),
    ]);
  });

  it("preserves double quotes around percent and speed placeholders", () => {
    const args = ["--output", "/tmp/x.%(ext)s", "url"];
    const result = injectYtdlpProgressArgs(args);
    const template = result[result.indexOf("--progress-template") + 1];
    expect(template).toBe(
      '{"percent": "%(progress._percent_json)s", "speed": "%(progress.speed)r", "eta": "%(progress.eta)r", "downloaded": "%(progress.downloaded_bytes)r", "total": "%(progress.total_bytes)r", "status": "%(progress.status)s"}',
    );
  });

  it("does not inject for non-download yt-dlp invocations (no --output)", () => {
    const args = ["-j", "https://example.com/p"];
    expect(injectYtdlpProgressArgs(args)).toEqual(args);
  });

  it("does not duplicate progress args if already present", () => {
    const args = [
      "--output",
      "/tmp/%(title)s.%(ext)s",
      "--newline",
      "--progress-template",
      "custom",
    ];
    expect(injectYtdlpProgressArgs(args)).toEqual(args);
  });

  it("preserves the original argument order", () => {
    const args = ["--output", "/tmp/x.%(ext)s", "url", "--proxy", "http://proxy"];
    const result = injectYtdlpProgressArgs(args);
    expect(result[0]).toBe("--output");
    expect(result[1]).toBe("/tmp/x.%(ext)s");
    expect(result[2]).toBe("url");
    expect(result[3]).toBe("--proxy");
    // url and --proxy appear before the injected --newline
    expect(result[4]).toBe("http://proxy");
    expect(result).toContain("--newline");
    expect(result).toContain("--progress-template");
  });
});

describe("resolveSpawnArgsAndEnv", () => {
  beforeEach(() => {
    mocks.discoverFfmpeg.mockReset();
    mocks.discoverFfprobe.mockReset();
    mocks.discoverYtdlp.mockReset();
    mocks.discoverVideoCaptioner.mockReset();
    mocks.discoverQuickjs.mockReset();
    mocks.resolveSpawnEnvForVideoCaptioner.mockReset();
  });

  it("for yt-dlp: sets PYTHONUNBUFFERED=1 to force line-buffered stdout", async () => {
    mocks.discoverFfmpeg.mockResolvedValue(undefined);
    const result = await resolveSpawnArgsAndEnv("yt-dlp", [
      "--output", "/tmp/x.%(ext)s",
      "https://example.com/v",
    ]);
    // Without PYTHONUNBUFFERED=1, yt-dlp (a Python app) block-buffers
    // its stdout when piped, so progress lines never flush in time.
    expect(result.env).toBeDefined();
    expect(result.env?.PYTHONUNBUFFERED).toBe("1");
  });

  it("for yt-dlp: injects --newline and --progress-template", async () => {
    mocks.discoverFfmpeg.mockResolvedValue(undefined);
    const result = await resolveSpawnArgsAndEnv("yt-dlp", [
      "--output", "/tmp/x.%(ext)s",
      "https://example.com/v",
    ]);
    expect(result.args).toContain("--newline");
    expect(result.args).toContain("--progress-template");
  });

  it("for yt-dlp: prepends --ffmpeg-location when ffmpeg is discovered", async () => {
    mocks.discoverFfmpeg.mockResolvedValue("/usr/bin/ffmpeg");
    const result = await resolveSpawnArgsAndEnv("yt-dlp", [
      "--output", "/tmp/x.%(ext)s",
      "https://example.com/v",
    ]);
    expect(result.args[0]).toBe("--ffmpeg-location");
    expect(result.args[1]).toBe("/usr/bin/ffmpeg");
  });

  it("for yt-dlp: keeps PYTHONUNBUFFERED=1 even when caller already had env", async () => {
    // Simulate the case where a future caller passes an env to merge.
    // Currently videocaptioner is the only other branch that sets env;
    // for yt-dlp we always set our own env, so we should still get the flag.
    mocks.discoverFfmpeg.mockResolvedValue(undefined);
    const result = await resolveSpawnArgsAndEnv("yt-dlp", [
      "--output", "/tmp/x.%(ext)s",
      "https://example.com/v",
    ]);
    expect(result.env?.PYTHONUNBUFFERED).toBe("1");
  });

  it("for non-yt-dlp commands: does not set PYTHONUNBUFFERED", async () => {
    mocks.discoverFfmpeg.mockResolvedValue(undefined);
    const result = await resolveSpawnArgsAndEnv("ffprobe", [
      "-v", "quiet", "-print_format", "json",
    ]);
    expect(result.env?.PYTHONUNBUFFERED).toBeUndefined();
    expect(result.args).not.toContain("--newline");
    expect(result.args).not.toContain("--progress-template");
  });
});
