import type { PlaylistMetadata, VideoMetadata } from "./types"

export function parse(stdout: string): VideoMetadata | PlaylistMetadata {
    const trimmed = stdout.trim()
    if (!trimmed) {
        throw new Error("yt-dlp produced empty stdout")
    }

    let json: unknown
    try {
        json = JSON.parse(trimmed)
    } catch {
        throw new Error("yt-dlp stdout is not valid JSON")
    }

    if (json === null || typeof json !== "object") {
        throw new Error("yt-dlp output is not a JSON object")
    }

    const obj = json as Record<string, unknown>

    if (obj._type === "playlist") {
        return parsePlaylist(obj)
    }
    if (!obj._type || obj._type === "video") {
        return parseVideo(obj)
    }

    throw new Error(`unknown yt-dlp output type: ${obj._type}`)
}

function parseVideo(obj: Record<string, unknown>): VideoMetadata {
    if (typeof obj.id !== "string" || !obj.id) {
        throw new Error("video metadata missing required field: id")
    }
    return obj as unknown as VideoMetadata
}

function parsePlaylist(obj: Record<string, unknown>): PlaylistMetadata {
    if (typeof obj.id !== "string" || !obj.id) {
        throw new Error("playlist metadata missing required field: id")
    }
    if (!Array.isArray(obj.entries)) {
        throw new Error("playlist metadata missing required field: entries")
    }

    const entries = obj.entries.map((entry: unknown) => {
        if (entry === null || typeof entry !== "object") {
            throw new Error("playlist entry is not an object")
        }
        return parseVideo(entry as Record<string, unknown>)
    })

    return { ...(obj as unknown as PlaylistMetadata), entries }
}

/**
 * Resolves format-listing metadata from `yt-dlp -J` output.
 * When yt-dlp returns a playlist (e.g. multi-part Bilibili URLs), uses the first entry.
 */
export function videoMetadataForFormatsListing(
    parsed: VideoMetadata | PlaylistMetadata,
): VideoMetadata {
    if ("entries" in parsed) {
        const playlist = parsed as PlaylistMetadata
        const first = playlist.entries[0]
        if (!first) {
            throw new Error("yt-dlp playlist has no entries")
        }
        return first
    }
    return parsed
}
