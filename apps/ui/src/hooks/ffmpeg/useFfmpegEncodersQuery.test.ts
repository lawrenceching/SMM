import { describe, expect, it } from "vitest";
import { parseFfmpegEncoders } from "./parseFfmpegEncoders";
import { buildFfmpegEncodersResult } from "./useFfmpegEncodersQuery";

describe("parseFfmpegEncoders", () => {
  it("extracts video encoder names", () => {
    const stdout = [
      "Encoders:",
      " V..... = Video",
      " A..... = Audio",
      " S..... = Subtitle",
      " ------",
      " V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (decoders: h264 )",
      " V..... libx265              libx265 H.265 / HEVC (decoders: hevc )",
      " V..... h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)",
      " A..... aac                  AAC (Advanced Audio Coding)",
    ].join("\n");
    expect(parseFfmpegEncoders(stdout)).toEqual([
      "aac",
      "h264_nvenc",
      "libx264",
      "libx265",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseFfmpegEncoders("")).toEqual([]);
  });

  it("ignores non-encoder lines", () => {
    const stdout = [
      "Some random text",
      "----",
      "encoders not found",
    ].join("\n");
    expect(parseFfmpegEncoders(stdout)).toEqual([]);
  });
});

describe("buildFfmpegEncodersResult", () => {
  it("splits catalog into usable and unavailable", () => {
    const result = buildFfmpegEncodersResult(["libx264", "h264_nvenc"]);
    expect(result.available).toEqual(["libx264", "h264_nvenc"]);
    expect(result.usable.find((e) => e.id === "libx264")).toBeDefined();
    expect(result.unavailable.find((e) => e.id === "libx265")).toBeDefined();
  });

  it("returns empty usable list when no catalog match", () => {
    const result = buildFfmpegEncodersResult(["nonexistent_encoder"]);
    expect(result.usable).toEqual([]);
    // All catalog entries are unavailable
    expect(result.unavailable.length).toBeGreaterThan(0);
  });
});
