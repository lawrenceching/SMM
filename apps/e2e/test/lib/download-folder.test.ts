import { describe, expect, test } from "bun:test"
import {
    isCompletedVideoFileName,
    isIncompleteDownloadFileName,
    isYtdlpFormatFragment,
} from "./download-folder.ts"

describe("isYtdlpFormatFragment", () => {
    test("detects DASH/HLS format-id intermediates", () => {
        expect(isYtdlpFormatFragment("video [BV1].f100026.mp4")).toBe(true)
        expect(isYtdlpFormatFragment("video [BV1].f30280.m4a")).toBe(true)
        expect(isYtdlpFormatFragment("video [BV1].f100026.mp4.part")).toBe(true)
    })

    test("rejects merged final filenames", () => {
        expect(isYtdlpFormatFragment("video [BV1].mp4")).toBe(false)
        expect(isYtdlpFormatFragment("video [BV1rY4y1P7er_p2].mp4")).toBe(false)
    })
})

describe("isCompletedVideoFileName", () => {
    test("accepts merged final videos", () => {
        expect(isCompletedVideoFileName("title [BV17NrWBaE87].mp4")).toBe(true)
        expect(isCompletedVideoFileName("ep [BV1rY4y1P7er_p1].mkv")).toBe(true)
        expect(isCompletedVideoFileName("ep [BV1rY4y1P7er_p2].webm")).toBe(true)
    })

    test("rejects .part downloads", () => {
        expect(isCompletedVideoFileName("title [BV17NrWBaE87].mp4.part")).toBe(false)
        expect(isCompletedVideoFileName("title [BV17NrWBaE87].f100026.mp4.part")).toBe(false)
    })

    test("rejects yt-dlp format fragments (pre-merge)", () => {
        expect(isCompletedVideoFileName("title [BV17NrWBaE87].f100026.mp4")).toBe(false)
        expect(isCompletedVideoFileName("title [BV17NrWBaE87].f30280.m4a")).toBe(false)
        expect(isCompletedVideoFileName("ep [BV1_p1].f401.mp4")).toBe(false)
        expect(isCompletedVideoFileName("ep [BV1_p2].f401.mp4")).toBe(false)
    })

    test("rejects non-video files", () => {
        expect(isCompletedVideoFileName("thumb [BV1].png")).toBe(false)
        expect(isCompletedVideoFileName("notes.txt")).toBe(false)
    })
})

describe("isIncompleteDownloadFileName", () => {
    test("treats .part and format fragments as in-progress", () => {
        expect(isIncompleteDownloadFileName("a.mp4.part")).toBe(true)
        expect(isIncompleteDownloadFileName("a.f100026.mp4")).toBe(true)
        expect(isIncompleteDownloadFileName("a.f30280.m4a.part")).toBe(true)
    })

    test("treats merged finals as complete", () => {
        expect(isIncompleteDownloadFileName("a [BV1].mp4")).toBe(false)
        expect(isIncompleteDownloadFileName("thumb.png")).toBe(false)
    })
})
