import { describe, it, expect } from "vitest";
import { parseYtdlpPlaylistStdout } from "./parseYtdlpPlaylistStdout";

describe("parseYtdlpPlaylistStdout", () => {
  it("parses multiple NDJSON lines", () => {
    const lines = [
      JSON.stringify({ id: "a", title: "First" }),
      JSON.stringify({ id: "b", title: "Second" }),
    ];
    const result = parseYtdlpPlaylistStdout(`${lines.join("\n")}\n`);
    expect(result).toEqual({
      videos: [
        { id: "a", title: "First" },
        { id: "b", title: "Second" },
      ],
    });
  });

  it("skips blank lines", () => {
    const line = JSON.stringify({ id: "only" });
    const result = parseYtdlpPlaylistStdout(`\n${line}\n\n`);
    expect(result).toEqual({ videos: [{ id: "only" }] });
  });

  it("returns error when a line is not valid JSON", () => {
    const result = parseYtdlpPlaylistStdout(
      `${JSON.stringify({ ok: true })}\nnot-json\n`
    );
    expect(result).toEqual({ error: "invalid JSON on stdout line 2" });
  });

  it("returns empty videos for empty string", () => {
    expect(parseYtdlpPlaylistStdout("")).toEqual({ videos: [] });
  });

  it("handles CRLF line endings", () => {
    const result = parseYtdlpPlaylistStdout(
      `${JSON.stringify({ id: "1" })}\r\n${JSON.stringify({ id: "2" })}\r\n`
    );
    expect(result).toEqual({
      videos: [{ id: "1" }, { id: "2" }],
    });
  });
});
