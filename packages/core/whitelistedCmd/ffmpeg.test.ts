import { describe, expect, it } from "vitest";
import { DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS } from "./constants";
import { buildFfmpegConvertArgs } from "./ffmpeg";

describe("buildFfmpegConvertArgs image formats", () => {
  const input = "/media/sample.mp4";
  const outputAvif = "/out/sample.avif";
  const outputWebp = "/out/sample.webp";
  const outputApng = "/out/sample.apng";

  it("builds animated avif args with fps and scale", () => {
    const options = {
      ...DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS,
      fps: 12,
      maxWidth: 480,
      avif: { crf: 28, cpuUsed: 6, loop: "infinite" as const },
    };
    const args = buildFfmpegConvertArgs(input, outputAvif, "avif", "balanced", options);

    expect(args).toContain("-vf");
    expect(args).toContain("fps=12,scale=480:-2:flags=lanczos");
    expect(args).toContain("-c:v");
    expect(args).toContain("libaom-av1");
    expect(args).toContain("-crf");
    expect(args).toContain("28");
    expect(args).toContain("-cpu-used");
    expect(args).toContain("6");
    expect(args).toContain("-f");
    expect(args).toContain("avif");
    expect(args).toContain("-loop");
    expect(args).toContain("0");
  });

  it("builds still avif args with single frame", () => {
    const options = {
      ...DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS,
      mode: "still" as const,
    };
    const args = buildFfmpegConvertArgs(input, outputAvif, "avif", "balanced", options);

    expect(args).toContain("-vframes");
    expect(args).toContain("1");
    expect(args).toContain("-still-picture");
    expect(args).not.toContain("-loop");
  });

  it("builds animated webp args with quality and preset", () => {
    const options = {
      ...DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS,
      webp: {
        lossless: false,
        quality: 90,
        preset: "photo" as const,
        loop: "once" as const,
      },
    };
    const args = buildFfmpegConvertArgs(input, outputWebp, "webp", "balanced", options);

    expect(args).toContain("-c:v");
    expect(args).toContain("libwebp_anim");
    expect(args).toContain("-quality");
    expect(args).toContain("90");
    expect(args).toContain("-preset");
    expect(args).toContain("photo");
    expect(args).not.toContain("-loop");
  });

  it("builds lossless still webp args", () => {
    const options = {
      ...DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS,
      mode: "still" as const,
      webp: {
        lossless: true,
        quality: 80,
        preset: "default" as const,
        loop: "once" as const,
      },
    };
    const args = buildFfmpegConvertArgs(input, outputWebp, "webp", "balanced", options);

    expect(args).toContain("libwebp");
    expect(args).toContain("-lossless");
    expect(args).toContain("1");
    expect(args).not.toContain("-quality");
  });

  it("builds apng args with pred and infinite loop", () => {
    const options = {
      ...DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS,
      apng: { pred: "mixed" as const, loop: "infinite" as const },
    };
    const args = buildFfmpegConvertArgs(input, outputApng, "apng", "balanced", options);

    expect(args).toContain("-c:v");
    expect(args).toContain("apng");
    expect(args).toContain("-pred");
    expect(args).toContain("mixed");
    expect(args).toContain("-plays");
    expect(args).toContain("0");
  });
});
