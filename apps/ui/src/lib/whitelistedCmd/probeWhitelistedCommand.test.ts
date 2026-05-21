import { describe, expect, it } from "vitest";
import { versionProbeArgs } from "./probeWhitelistedCommand";

describe("versionProbeArgs", () => {
  it("uses -version for ffmpeg and ffprobe", () => {
    expect(versionProbeArgs("ffmpeg")).toEqual(["-version"]);
    expect(versionProbeArgs("ffprobe")).toEqual(["-version"]);
  });

  it("uses --version for yt-dlp and videocaptioner", () => {
    expect(versionProbeArgs("yt-dlp")).toEqual(["--version"]);
    expect(versionProbeArgs("videocaptioner")).toEqual(["--version"]);
  });
});
