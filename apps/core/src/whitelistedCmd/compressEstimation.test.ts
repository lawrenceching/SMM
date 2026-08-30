import { describe, expect, it } from "vitest";
import {
  estimateCompressAudioBitrateKbps,
  estimateCompressSizeMb,
  estimateCompressVideoBitrateKbps,
  type CompressEstimationProbe,
} from "./compressEstimation";
import type { FfmpegCompressOptions } from "./constants";

const probeHD: CompressEstimationProbe = {
  durationSec: 600, // 10 min
  width: 1920,
  height: 1080,
  videoBitrateKbps: 5000,
  audioBitrateKbps: 128,
  totalBitrateKbps: 5128,
  fps: 30,
};

const probeSD: CompressEstimationProbe = {
  durationSec: 300,
  width: 1280,
  height: 720,
  videoBitrateKbps: 1500,
  audioBitrateKbps: 128,
  totalBitrateKbps: 1628,
  fps: 24,
};

const baseOptions: FfmpegCompressOptions = {
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
  filters: { denoise: "none", sharpen: false },
  metadata: "preserve",
};

describe("estimateCompressVideoBitrateKbps", () => {
  it("returns target bitrate directly in targetBitrate mode", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      qualityMode: "targetBitrate",
      targetBitrateKbps: 4000,
    };
    expect(estimateCompressVideoBitrateKbps(opts, probeHD)).toBe(4000);
  });

  it("derives bitrate from target size in targetSize mode", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      qualityMode: "targetSize",
      targetSizeMB: 100,
      audioBitrateKbps: 128,
    };
    // 100 MB * 8 * 1024 / 600 sec = 1365 total kbps
    // minus 128 audio = 1237 video
    const v = estimateCompressVideoBitrateKbps(opts, probeHD);
    expect(v).toBeGreaterThan(1000);
    expect(v).toBeLessThan(1500);
  });

  it("returns 0 for audio-only jobs", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      presetKey: "audioOnly",
      audioMode: "reencode",
      audioCodec: "aac",
      audioBitrateKbps: 192,
    };
    expect(estimateCompressVideoBitrateKbps(opts, probeHD)).toBe(0);
  });

  it("returns 0 when audioMode is remove", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      audioMode: "remove",
    };
    expect(estimateCompressVideoBitrateKbps(opts, probeHD)).toBe(0);
  });

  it("estimates ~3-7 Mbps for libx264 CRF 23 at 1080p30", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      videoEncoder: "libx264",
      qualityMode: "crf",
      crf: 23,
    };
    const v = estimateCompressVideoBitrateKbps(opts, probeHD);
    expect(v).toBeGreaterThan(3000);
    expect(v).toBeLessThan(7000);
  });

  it("halves bitrate for each +6 CRF (libx264)", () => {
    const at23 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "libx264", crf: 23 },
      probeHD,
    );
    const at29 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "libx264", crf: 29 },
      probeHD,
    );
    const at35 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "libx264", crf: 35 },
      probeHD,
    );
    // Each +6 ≈ half. Allow ±20% slack for the 720p source vs 1080p encoding.
    expect(at23 / at29).toBeGreaterThan(1.5);
    expect(at23 / at29).toBeLessThan(2.5);
    expect(at23 / at35).toBeGreaterThan(3);
    expect(at23 / at35).toBeLessThan(5);
  });

  it("libx265 produces lower bitrate than libx264 at the same CRF", () => {
    const x264 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "libx264", crf: 23 },
      probeHD,
    );
    const x265 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "libx265", crf: 28 },
      probeHD,
    );
    // x265 should be roughly half of x264 at equivalent quality
    expect(x265).toBeLessThan(x264);
  });

  it("720p estimate is lower than 1080p at the same settings", () => {
    const at1080 = estimateCompressVideoBitrateKbps(baseOptions, probeHD);
    const at720 = estimateCompressVideoBitrateKbps(baseOptions, probeSD);
    expect(at720).toBeLessThan(at1080);
  });

  it("scales estimate down for downscaled resolution mode", () => {
    const original = estimateCompressVideoBitrateKbps(baseOptions, probeHD);
    const to720 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, resolutionMode: "720p" },
      probeHD,
    );
    expect(to720).toBeLessThan(original);
  });

  it("never upscales: a 480p source stays 480p when target is 1080p", () => {
    const tinyProbe: CompressEstimationProbe = {
      ...probeHD,
      width: 640,
      height: 480,
    };
    const v = estimateCompressVideoBitrateKbps(
      { ...baseOptions, resolutionMode: "1080p" },
      tinyProbe,
    );
    // Estimate should match the 480p encoding rate, not 1080p
    const tinyNative = estimateCompressVideoBitrateKbps(baseOptions, tinyProbe);
    expect(v).toBe(tinyNative);
  });

  it("content factor: low-bitrate source yields lower estimate", () => {
    const lowBitrate: CompressEstimationProbe = {
      ...probeHD,
      videoBitrateKbps: 1000, // screen recording-like
    };
    const highBitrate: CompressEstimationProbe = {
      ...probeHD,
      videoBitrateKbps: 10000, // action movie-like
    };
    const vLow = estimateCompressVideoBitrateKbps(baseOptions, lowBitrate);
    const vHigh = estimateCompressVideoBitrateKbps(baseOptions, highBitrate);
    expect(vHigh).toBeGreaterThan(vLow);
  });

  it("content factor is clamped to [0.3, 3.0]", () => {
    const extreme: CompressEstimationProbe = {
      ...probeHD,
      videoBitrateKbps: 100000, // 100 Mbps source
    };
    const v = estimateCompressVideoBitrateKbps(baseOptions, extreme);
    // Without clamp, factor would be ~16x. With clamp at 3.0, factor is 3.0.
    // probeHD has factor 0.804, so ratio = 3.0 / 0.804 = ~3.73x.
    const normal = estimateCompressVideoBitrateKbps(baseOptions, probeHD);
    expect(v / normal).toBeLessThan(4.5);
  });

  it("falls back to 1.0 content factor when source bitrate is missing", () => {
    const noBitrate: CompressEstimationProbe = {
      ...probeHD,
      videoBitrateKbps: undefined,
      totalBitrateKbps: undefined,
    };
    const v = estimateCompressVideoBitrateKbps(baseOptions, noBitrate);
    // Without source calibration, content factor defaults to 1.0
    // (instead of the 0.804 derived from probeHD's 5 Mbps source)
    const calibrated = estimateCompressVideoBitrateKbps(baseOptions, probeHD);
    expect(v).toBeGreaterThan(calibrated);
  });

  it("VideoToolbox q:v 70 maps to ~CRF 23 (default)", () => {
    const vt = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "h264_videotoolbox", crf: 70 },
      probeHD,
    );
    const x264 = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "libx264", crf: 23 },
      probeHD,
    );
    // h264_videotoolbox calibration: 0.14 bpp/s at q:v 70 (default)
    // libx264: 0.10 bpp/s at CRF 23 (default). Ratio: 1.4x.
    expect(vt / x264).toBeGreaterThan(1.0);
    expect(vt / x264).toBeLessThan(2.0);
  });

  it("VideoToolbox lower q:v produces higher bitrate (better quality)", () => {
    const lowQ = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "h264_videotoolbox", crf: 50 },
      probeHD,
    );
    const highQ = estimateCompressVideoBitrateKbps(
      { ...baseOptions, videoEncoder: "h264_videotoolbox", crf: 90 },
      probeHD,
    );
    expect(lowQ).toBeGreaterThan(highQ);
  });
});

describe("estimateCompressAudioBitrateKbps", () => {
  it("returns 0 when audioMode is remove", () => {
    expect(
      estimateCompressAudioBitrateKbps(
        { ...baseOptions, audioMode: "remove" },
        probeHD,
      ),
    ).toBe(0);
  });

  it("returns user bitrate for reencode mode", () => {
    expect(
      estimateCompressAudioBitrateKbps(
        { ...baseOptions, audioMode: "reencode", audioBitrateKbps: 256 },
        probeHD,
      ),
    ).toBe(256);
  });

  it("falls back to source bitrate in keep mode", () => {
    expect(
      estimateCompressAudioBitrateKbps({ ...baseOptions, audioMode: "keep" }, probeHD),
    ).toBe(128);
  });

  it("falls back to 128 kbps in keep mode when source bitrate is unknown", () => {
    expect(
      estimateCompressAudioBitrateKbps(
        { ...baseOptions, audioMode: "keep" },
        { ...probeHD, audioBitrateKbps: undefined },
      ),
    ).toBe(128);
  });
});

describe("estimateCompressSizeMb", () => {
  it("returns null when duration is missing", () => {
    const result = estimateCompressSizeMb(baseOptions, { ...probeHD, durationSec: 0 });
    expect(result).toBeNull();
  });

  it("returns a sensible estimate for a typical 10-min 1080p clip", () => {
    const r = estimateCompressSizeMb(baseOptions, probeHD);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.estimatedSizeMB).toBeGreaterThan(50);
    expect(r.estimatedSizeMB).toBeLessThan(400);
    expect(r.pctOfSource).toBeGreaterThan(0);
    expect(r.pctOfSource).toBeLessThan(2);
  });

  it("computes size as (bitrate * duration) formula", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      qualityMode: "targetBitrate",
      targetBitrateKbps: 2000,
    };
    const r = estimateCompressSizeMb(opts, probeHD);
    // 2000 kbps + 128 audio = 2128 kbps × 600 sec = 1,276,800 kbit
    // = 159,600 kB = 159.6 MB (decimal)
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.videoBitrateKbps).toBe(2000);
    expect(r.audioBitrateKbps).toBe(128);
    expect(r.totalBitrateKbps).toBe(2128);
    expect(r.estimatedSizeMB).toBeCloseTo(159.6, 1);
  });

  it("audio-only size = audio bitrate × duration only", () => {
    const opts: FfmpegCompressOptions = {
      ...baseOptions,
      presetKey: "audioOnly",
      audioMode: "reencode",
      audioCodec: "aac",
      audioBitrateKbps: 192,
    };
    const r = estimateCompressSizeMb(opts, probeHD);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.videoBitrateKbps).toBe(0);
    expect(r.audioBitrateKbps).toBe(192);
    // 192 kbps × 600 sec = 115,200 kbit = 14.4 MB
    expect(r.estimatedSizeMB).toBeCloseTo(14.4, 1);
  });

  it("pctOfSource is undefined when source bitrate is missing", () => {
    const r = estimateCompressSizeMb(baseOptions, {
      ...probeHD,
      totalBitrateKbps: undefined,
      videoBitrateKbps: undefined,
      audioBitrateKbps: undefined,
    });
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.pctOfSource).toBeUndefined();
  });
});
