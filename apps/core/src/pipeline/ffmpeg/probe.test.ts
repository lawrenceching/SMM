import { describe, expect, it } from "vitest";
import { parseFfprobeJson } from "./probe";

describe("parseFfprobeJson", () => {
  it("extracts duration, width, and height from ffprobe JSON", () => {
    const stdout = JSON.stringify({
      format: { duration: "123.456" },
      streams: [
        { codec_type: "audio", codec_name: "aac" },
        { codec_type: "video", width: 1920, height: 1080 },
      ],
    });
    expect(parseFfprobeJson(stdout)).toEqual({
      durationSec: 123.456,
      width: 1920,
      height: 1080,
    });
  });

  it("returns empty probe on malformed JSON", () => {
    expect(parseFfprobeJson("not json")).toEqual({
      durationSec: 0,
      width: 0,
      height: 0,
    });
  });

  it("returns empty probe when video stream is missing", () => {
    const stdout = JSON.stringify({
      format: { duration: "10" },
      streams: [{ codec_type: "audio" }],
    });
    expect(parseFfprobeJson(stdout)).toEqual({
      durationSec: 10,
      width: 0,
      height: 0,
    });
  });
});
