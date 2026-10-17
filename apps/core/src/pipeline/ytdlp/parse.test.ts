import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse, videoMetadataForFormatsListing } from "./parse";
import type { PlaylistMetadata, VideoMetadata } from "./types";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../../../docs/ytdlp");

function readFixture(name: string): string {
    return readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
}

function isVideoMetadata(v: unknown): v is VideoMetadata {
    return (v as Record<string, unknown>)._type !== "playlist";
}

function asPlaylistMetadata(v: unknown): PlaylistMetadata {
    return v as PlaylistMetadata;
}

describe("parse", () => {
    it("parses a single video JSON", () => {
        const stdout = readFixture("dump-single-video.json");
        const result = parse(stdout);

        expect(isVideoMetadata(result)).toBe(true);
        const video = result as VideoMetadata;
        expect(video.id).toBe("BV1fZRUBuEqc");
        expect(video.title).toBeTruthy();
        expect(video.uploader).toBeTruthy();
        expect(video.duration).toBe(34.566);
        expect(video.formats).toBeInstanceOf(Array);
        expect(video.formats.length).toBeGreaterThan(0);
        expect(video.formats[0]!.format_id).toBe("30216");
        expect(video.thumbnails).toBeInstanceOf(Array);
        expect(video._type).toBe("video");
        expect(video._version).toBeDefined();
        expect(video._version!.repository).toBe("yt-dlp/yt-dlp");
    });

    it("parses a playlist JSON", () => {
        const stdout = readFixture("dump-episodes.json");
        const result = parse(stdout);

        expect(isVideoMetadata(result)).toBe(false);
        const playlist = asPlaylistMetadata(result);
        expect(playlist._type).toBe("playlist");
        expect(playlist.id).toBe("BV1xJ38z3EkX");
        expect(playlist.title).toBeTruthy();
        expect(playlist.entries).toBeInstanceOf(Array);
        expect(playlist.entries.length).toBeGreaterThanOrEqual(2);
        expect(playlist.playlist_count).toBe(9);
    });

    it("parses playlist entries as VideoMetadata", () => {
        const stdout = readFixture("dump-episodes.json");
        const playlist = asPlaylistMetadata(parse(stdout));

        const entry = playlist.entries[0]!;
        expect(entry.id).toBe("BV1xJ38z3EkX_p1");
        expect(entry.playlist_index).toBe(1);
        expect(entry.playlist_count).toBe(9);
        expect(entry.n_entries).toBe(9);
        expect(entry.playlist_autonumber).toBe(1);
        expect(entry.formats).toBeInstanceOf(Array);
        expect(entry.formats.length).toBeGreaterThan(0);
        expect(entry.requested_downloads).toBeInstanceOf(Array);
    });

    it("playlist second entry has correct index", () => {
        const stdout = readFixture("dump-episodes.json");
        const playlist = asPlaylistMetadata(parse(stdout));

        const entry = playlist.entries[1]!;
        expect(entry.id).toBe("BV1xJ38z3EkX_p2");
        expect(entry.playlist_index).toBe(2);
        expect(entry.playlist_autonumber).toBe(2);
    });

    it("videoMetadataForFormatsListing uses first playlist entry", () => {
        const stdout = readFixture("dump-episodes.json");
        const parsed = parse(stdout);
        const video = videoMetadataForFormatsListing(parsed);

        expect(video.id).toBe("BV1xJ38z3EkX_p1");
        expect(video.formats.length).toBeGreaterThan(0);
        expect(video.playlist_index).toBe(1);
    });

    it("videoMetadataForFormatsListing returns single video as-is", () => {
        const stdout = readFixture("dump-single-video.json");
        const parsed = parse(stdout);
        const video = videoMetadataForFormatsListing(parsed);

        expect(video.id).toBe("BV1fZRUBuEqc");
    });
});

describe("parse error cases", () => {
    it("throws on empty string", () => {
        expect(() => parse("")).toThrow(/empty/);
    });

    it("throws on whitespace-only string", () => {
        expect(() => parse("   \n  ")).toThrow(/empty/);
    });

    it("throws on invalid JSON", () => {
        expect(() => parse("not valid json")).toThrow(/not valid JSON/);
    });

    it("throws on non-object JSON", () => {
        expect(() => parse("123")).toThrow(/not a JSON object/);
    });

    it("throws on unknown _type", () => {
        expect(() => parse(JSON.stringify({ _type: "unknown", id: "x" }))).toThrow(
            /unknown/
        );
    });

    it("throws when video metadata has no id", () => {
        expect(() => parse(JSON.stringify({ _type: "video" }))).toThrow(
            /missing required field: id/
        );
    });

    it("throws when playlist metadata has no id", () => {
        expect(() =>
            parse(JSON.stringify({ _type: "playlist", entries: [] }))
        ).toThrow(/missing required field: id/);
    });

    it("throws when playlist metadata has no entries array", () => {
        expect(() =>
            parse(JSON.stringify({ _type: "playlist", id: "x" }))
        ).toThrow(/missing required field: entries/);
    });

    it("videoMetadataForFormatsListing throws when playlist has no entries", () => {
        const playlist = parse(
            JSON.stringify({ _type: "playlist", id: "x", entries: [] }),
        );
        expect(() => videoMetadataForFormatsListing(playlist)).toThrow(/no entries/);
    });
});
