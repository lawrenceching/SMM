import { describe, expect, it } from "vitest";
import { DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS } from "./constants";
import { buildFfmpegConvertArgs, buildFfmpegCompressArgs } from "./ffmpeg";
import { computeTargetBitrateKbpsFromSize, getFfmpegCompressPreset } from "./constants";

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

describe("computeTargetBitrateKbpsFromSize", () => {
  it("computes video bitrate for a target size", () => {
    // 200 MB / 600 sec, audio 128 kbps
    // total kbps = 200 * 8 * 1024 / 600 = 2730
    // video = 2730 - 128 = 2602
    const kbps = computeTargetBitrateKbpsFromSize(200, 600, 128);
    expect(kbps).toBeGreaterThan(2500);
    expect(kbps).toBeLessThan(2700);
  });

  it("clamps to at least 100 kbps", () => {
    // tiny size, large audio bitrate
    const kbps = computeTargetBitrateKbpsFromSize(1, 60, 100_000);
    expect(kbps).toBe(100);
  });

  it("returns 0 for invalid inputs", () => {
    expect(computeTargetBitrateKbpsFromSize(0, 100, 0)).toBe(0);
    expect(computeTargetBitrateKbpsFromSize(100, 0, 0)).toBe(0);
  });
});

describe("buildFfmpegCompressArgs", () => {
  const probe = { durationSec: 600, width: 1920, height: 1080 };

  it("builds single-pass args for balanced preset", () => {
    const preset = getFfmpegCompressPreset("balanced");
    if (!preset) throw new Error("balanced preset missing");
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mp4",
      preset.options,
      probe,
    );
    expect(run.kind).toBe("single");
    if (run.kind !== "single") return;
    const args = run.args;
    expect(args).toContain("-i");
    expect(args).toContain("/media/in.mp4");
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("-crf");
    expect(args).toContain("23");
    expect(args).toContain("-preset");
    expect(args).toContain("medium");
    expect(args).toContain("-c:a");
    expect(args).toContain("copy"); // audioMode: keep
    expect(args).toContain("-f");
    expect(args).toContain("mp4");
    expect(args).toContain("/media/out.mp4");
  });

  it("builds two-pass args for target size", () => {
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mp4",
      {
        presetKey: "custom",
        container: "mp4",
        videoEncoder: "libx264",
        qualityMode: "targetSize",
        targetSizeMB: 200,
        encoderPreset: "medium",
        audioMode: "reencode",
        audioCodec: "aac",
        audioBitrateKbps: 128,
        resolutionMode: "original",
        frameRateMode: "original",
        twoPass: false,
        hdr: "preserve",
        filters: { denoise: "none", sharpen: false },
        metadata: "preserve",
      },
      probe,
    );
    expect(run.kind).toBe("two-pass");
    if (run.kind !== "two-pass") return;
    expect(run.pass1Args).toContain("-pass");
    expect(run.pass1Args).toContain("1");
    expect(run.pass1Args).toContain("-an");
    expect(run.pass1Args).toContain("-f");
    expect(run.pass1Args).toContain("null");
    expect(run.pass2Args).toContain("-pass");
    expect(run.pass2Args).toContain("2");
    expect(run.pass2Args).toContain("/media/out.mp4");
    expect(run.pass2Args).toContain("-b:v");
    // bitrate computed from 200 MB / 600 sec - 128 kbps audio
    expect(run.passLogPath).toMatch(/ffmpeg2pass-/);
  });

  it("builds audio-only args with -vn", () => {
    const preset = getFfmpegCompressPreset("audioOnly");
    if (!preset) throw new Error("audioOnly preset missing");
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mp4",
      preset.options,
      probe,
    );
    expect(run.kind).toBe("single");
    if (run.kind !== "single") return;
    expect(run.args).toContain("-vn");
    // No video codec since audio-only
    expect(run.args).not.toContain("-c:v");
    expect(run.args).toContain("aac");
  });

  it("adds scale filter for 720p downscale", () => {
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mp4",
      {
        presetKey: "custom",
        container: "mp4",
        videoEncoder: "libx264",
        qualityMode: "crf",
        crf: 23,
        encoderPreset: "medium",
        audioMode: "keep",
        resolutionMode: "720p",
        frameRateMode: "original",
        twoPass: false,
        hdr: "preserve",
        filters: { denoise: "none", sharpen: false },
        metadata: "preserve",
      },
      probe,
    );
    expect(run.kind).toBe("single");
    if (run.kind !== "single") return;
    expect(run.args).toContain("-vf");
    expect(run.args.join(" ")).toContain("scale=-2:720");
  });

  it("does not upscale when source is smaller than target", () => {
    const smallProbe = { durationSec: 60, width: 1280, height: 720 };
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mp4",
      {
        presetKey: "custom",
        container: "mp4",
        videoEncoder: "libx264",
        qualityMode: "crf",
        crf: 23,
        encoderPreset: "medium",
        audioMode: "keep",
        resolutionMode: "1080p",
        frameRateMode: "original",
        twoPass: false,
        hdr: "preserve",
        filters: { denoise: "none", sharpen: false },
        metadata: "preserve",
      },
      smallProbe,
    );
    expect(run.kind).toBe("single");
    if (run.kind !== "single") return;
    // No -vf scale filter when resolution is preserved
    expect(run.args).not.toContain("-vf");
  });

  it("adds hqdn3d denoise when enabled", () => {
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mp4",
      {
        presetKey: "custom",
        container: "mp4",
        videoEncoder: "libx264",
        qualityMode: "crf",
        crf: 23,
        encoderPreset: "medium",
        audioMode: "keep",
        resolutionMode: "original",
        frameRateMode: "original",
        twoPass: false,
        hdr: "preserve",
        filters: { denoise: "medium", sharpen: false },
        metadata: "preserve",
      },
      probe,
    );
    expect(run.kind).toBe("single");
    if (run.kind !== "single") return;
    expect(run.args.join(" ")).toContain("hqdn3d=7:7:9:7");
  });

  it("uses -q:v for encoders that don't support CRF", () => {
    const run = buildFfmpegCompressArgs(
      "/media/in.mp4",
      "/media/out.mov",
      {
        presetKey: "custom",
        container: "mov",
        videoEncoder: "h264_videotoolbox",
        qualityMode: "crf",
        crf: 70,
        encoderPreset: "medium",
        audioMode: "keep",
        resolutionMode: "original",
        frameRateMode: "original",
        twoPass: false,
        hdr: "preserve",
        filters: { denoise: "none", sharpen: false },
        metadata: "preserve",
      },
      probe,
    );
    expect(run.kind).toBe("single");
    if (run.kind !== "single") return;
    expect(run.args).toContain("-q:v");
    expect(run.args).toContain("70");
    expect(run.args).not.toContain("-crf");
  });
});
