import { describe, expect, it } from "vitest";
import {
  buildYtdlpExtraArgsFromSelection,
  DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION,
} from "./ytdlpDownloadExtraArgs";

describe("ytdlpDownloadExtraArgs", () => {
  it("returns empty array when nothing is selected", () => {
    expect(buildYtdlpExtraArgsFromSelection(DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION)).toEqual(
      [],
    );
  });

  it("returns only selected flags in stable order", () => {
    expect(
      buildYtdlpExtraArgsFromSelection({
        "--write-thumbnail": true,
        "--embed-thumbnail": false,
        "--embed-metadata": true,
      }),
    ).toEqual(["--write-thumbnail", "--embed-metadata"]);
  });

  it("returns all flags when all are selected", () => {
    expect(
      buildYtdlpExtraArgsFromSelection({
        "--write-thumbnail": true,
        "--embed-thumbnail": true,
        "--embed-metadata": true,
      }),
    ).toEqual(["--write-thumbnail", "--embed-thumbnail", "--embed-metadata"]);
  });
});
