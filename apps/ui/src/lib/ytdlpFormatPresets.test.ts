import { describe, it, expect } from "vitest";
import {
  resolveYtdlpFormatFromPreset,
  YTDLP_FORMAT_PRESETS,
  isYtdlpFormatPresetId,
} from "./ytdlpFormatPresets";

describe("ytdlpFormatPresets", () => {
  it("maps preset ids to yt-dlp format expressions", () => {
    expect(resolveYtdlpFormatFromPreset("default")).toBeUndefined();
    expect(resolveYtdlpFormatFromPreset("best")).toBe("bestvideo*+ba/b");
    expect(resolveYtdlpFormatFromPreset("1080p")).toBe(
      "bv*[height<=1080]+ba/b[height<=1080]/best"
    );
    expect(resolveYtdlpFormatFromPreset("720p")).toBe(
      "bv*[height<=720]+ba/b[height<=720]/best"
    );
    expect(resolveYtdlpFormatFromPreset("audio")).toBe("bestaudio/best");
  });

  it("returns undefined for unknown preset id", () => {
    expect(resolveYtdlpFormatFromPreset("not-a-preset")).toBeUndefined();
  });

  it("defines a format string for every non-default preset", () => {
    for (const preset of YTDLP_FORMAT_PRESETS) {
      if (preset.id === "default") {
        expect(preset.format).toBeUndefined();
      } else {
        expect(preset.format?.trim()).toBeTruthy();
      }
    }
  });

  it("validates known preset ids", () => {
    expect(isYtdlpFormatPresetId("1080p")).toBe(true);
    expect(isYtdlpFormatPresetId("unknown")).toBe(false);
  });
});
