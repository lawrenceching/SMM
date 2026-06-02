import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyFfmpegConvertError,
  FfmpegConvertError,
} from "./ffmpegConvertErrorDetection";

describe("classifyFfmpegConvertError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies timeout from systemMessage", () => {
    const result = classifyFfmpegConvertError({
      exitCode: null,
      stderr: "",
      systemMessage: "ffmpeg command timed out",
    });
    expect(result.type).toBe("timeout");
    expect(result.i18nKey).toBe("formatConverter.errors.timeout");
  });

  it("classifies exit code 123 as cancelled", () => {
    const result = classifyFfmpegConvertError({ exitCode: 123, stderr: "" });
    expect(result.type).toBe("cancelled");
  });

  it("classifies exit code 69 as error-rate-exceeded", () => {
    const result = classifyFfmpegConvertError({ exitCode: 69, stderr: "" });
    expect(result.type).toBe("error-rate-exceeded");
  });

  it("classifies unknown encoder", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "[aost#0:0] Unknown encoder 'libvpx-vp9'",
    });
    expect(result.type).toBe("encoder-not-found");
  });

  it("classifies unknown decoder", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Unknown decoder 'av1'",
    });
    expect(result.type).toBe("decoder-not-found");
  });

  it("classifies muxer not found", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Unable to find a suitable output format for 'out.xyz'",
    });
    expect(result.type).toBe("muxer-not-found");
  });

  it("classifies demuxer not found", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Unable to find a suitable input format for 'in.xyz'",
    });
    expect(result.type).toBe("demuxer-not-found");
  });

  it("classifies filter not found", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Filter 'scale_npp' not found",
    });
    expect(result.type).toBe("filter-not-found");
  });

  it("classifies invalid data", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Invalid data found when processing input",
    });
    expect(result.type).toBe("invalid-data");
  });

  it("classifies file not found", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "in.mp4: No such file or directory",
    });
    expect(result.type).toBe("file-not-found");
  });

  it("classifies permission denied", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "out.mp4: Permission denied",
    });
    expect(result.type).toBe("permission-denied");
  });

  it("classifies disk full", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Error writing output: No space left on device",
    });
    expect(result.type).toBe("disk-full");
  });

  it("classifies out of memory", () => {
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "Cannot allocate memory",
    });
    expect(result.type).toBe("out-of-memory");
  });

  it("classifies exit 1 with unmatched stderr as generic and logs", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = classifyFfmpegConvertError({
      exitCode: 1,
      stderr: "some unexpected ffmpeg failure",
    });
    expect(result.type).toBe("generic");
    expect(consoleError).toHaveBeenCalled();
  });

  it("classifies unexpected exit code as unknown and logs", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = classifyFfmpegConvertError({
      exitCode: 99,
      stderr: "weird failure",
    });
    expect(result.type).toBe("unknown");
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("FfmpegConvertError", () => {
  it("carries type and i18nKey", () => {
    const err = new FfmpegConvertError({
      type: "encoder-not-found",
      i18nKey: "formatConverter.errors.encoderNotFound",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.type).toBe("encoder-not-found");
    expect(err.i18nKey).toBe("formatConverter.errors.encoderNotFound");
  });
});
