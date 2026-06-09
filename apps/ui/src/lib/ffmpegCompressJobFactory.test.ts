import { describe, expect, it } from "vitest";
import { buildFfmpegCompressJob, compressContainerToFormat } from "./ffmpegCompressJobFactory";
import type { FfmpegCompressOptions } from "@core/whitelistedCmd/constants";

const baseOptions: FfmpegCompressOptions = {
  presetKey: "balanced",
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
  filters: { denoise: "none", sharpen: false },
  metadata: "preserve",
};

describe("compressContainerToFormat", () => {
  it("maps each container to the matching opaque format token", () => {
    expect(compressContainerToFormat("mp4")).toBe("compress-mp4");
    expect(compressContainerToFormat("mkv")).toBe("compress-mkv");
    expect(compressContainerToFormat("webm")).toBe("compress-webm");
    expect(compressContainerToFormat("mov")).toBe("compress-mov");
  });
});

describe("buildFfmpegCompressJob", () => {
  it("builds a job with compression options and platform paths", () => {
    const job = buildFfmpegCompressJob({
      inputPath: "C:\\videos\\in.mp4",
      outputPath: "C:\\videos\\out.mp4",
      outputContainer: "mp4",
      compressOptions: baseOptions,
      title: "in.mp4",
    });

    expect(job.type).toBe("ffmpeg-convert");
    expect(job.status).toBe("pending");
    expect(job.name).toBe("Compress: in.mp4");
    expect(job.data.outputFormat).toBe("compress-mp4");
    expect(job.data.preset).toBe("compress");
    expect(job.data.compressOptions).toBe(baseOptions);
    // POSIX path with forward slashes
    expect(job.data.inputPath).toContain("/");
    expect(job.data.outputPath).toContain("/");
    // Platform path preserves the OS separator
    expect(job.data.inputPathPlatform).toContain("\\");
    expect(job.data.outputPathPlatform).toContain("\\");
  });

  it("uses the input path as title when no title provided", () => {
    const job = buildFfmpegCompressJob({
      inputPath: "/media/clip.mkv",
      outputPath: "/media/clip-out.mp4",
      outputContainer: "mp4",
      compressOptions: baseOptions,
      title: "",
    });
    expect(job.name).toContain("Compress:");
    expect(job.data.title).toBe("/media/clip.mkv");
  });
});
