import { describe, expect, it } from "vitest";
import {
  computeFfmpegProgress,
  parseDurationSeconds,
  parseFfmpegProgressLine,
  parseHmsTime,
} from "./progress";

describe("parseHmsTime", () => {
  it("parses fractional seconds", () => {
    expect(parseHmsTime("00:02:59.71")).toBeCloseTo(179.71, 2);
  });

  it("parses whole hours", () => {
    expect(parseHmsTime("01:00:00")).toBe(3600);
  });
});

describe("parseFfmpegProgressLine", () => {
  it("parses time and speed from a typical stderr line", () => {
    const line =
      "frame= 5390 fps=253 q=39.7 Lsize=    4998KiB time=00:02:59.60 bitrate= 227.9kbits/s speed=8.41x elapsed=0:00:21.34";
    expect(parseFfmpegProgressLine(line)).toEqual({
      currentSeconds: closeTo(179.6, 1),
      speedMultiplier: 8.41,
    });
  });

  it("tolerates CLI log line prefix", () => {
    const line =
      "2026-01-01T12:00:00.000Z [STDERR] frame=   77 fps=0.0 q=31.9 size=       0KiB time=00:00:02.50 bitrate=   0.1kbits/s speed=4.77x elapsed=0:00:00.52";
    expect(parseFfmpegProgressLine(line)).toEqual({
      currentSeconds: 2.5,
      speedMultiplier: 4.77,
    });
  });

  it("returns null when time= is absent", () => {
    expect(parseFfmpegProgressLine("not a progress line")).toBeNull();
  });
});

describe("parseDurationSeconds", () => {
  it("parses Duration from ffmpeg stderr", () => {
    const line =
      "  Duration: 00:05:00.00, start: 0.000000, bitrate: 1234 kb/s";
    expect(parseDurationSeconds(line)).toBe(300);
  });

  it("tolerates CLI log line prefix", () => {
    const line =
      "2026-01-01T12:00:00.000Z [STDERR]   Duration: 00:01:30.50, start: 0.000000, bitrate: 500 kb/s";
    expect(parseDurationSeconds(line)).toBeCloseTo(90.5, 2);
  });
});

describe("computeFfmpegProgress", () => {
  it("maps raw 0–100 percent into mapStart–mapEnd (first half 0–50)", () => {
    const result = computeFfmpegProgress({
      currentSeconds: 50,
      totalSeconds: 100,
      speedMultiplier: 2,
      mapStart: 0,
      mapEnd: 50,
    });
    expect(result.progress).toBe(25);
    expect(result.etaSeconds).toBe(25);
  });

  it("maps encode progress into second half 50–100", () => {
    const result = computeFfmpegProgress({
      currentSeconds: 50,
      totalSeconds: 100,
      speedMultiplier: null,
      mapStart: 50,
      mapEnd: 100,
    });
    expect(result.progress).toBe(75);
    expect(result.etaSeconds).toBeUndefined();
  });

  it("clamps progress at mapEnd when current exceeds total", () => {
    const result = computeFfmpegProgress({
      currentSeconds: 200,
      totalSeconds: 100,
      speedMultiplier: 1,
      mapStart: 0,
      mapEnd: 100,
    });
    expect(result.progress).toBe(100);
    expect(result.etaSeconds).toBe(0);
  });
});

function closeTo(expected: number, precision: number) {
  return expect.closeTo(expected, precision);
}
