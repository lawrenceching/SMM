import type { MediaMetadata } from "@core/types";

export function mediaMetadataToString(mediaMetadata: MediaMetadata): string {
    const obj: Record<string, unknown> = structuredClone(mediaMetadata) as Record<string, unknown>;
    obj.files = mediaMetadata.files === undefined ? undefined : `<${mediaMetadata.files?.length ?? 0} files>`;
    obj.mediaFiles = mediaMetadata.mediaFiles === undefined ? undefined : `<${mediaMetadata.mediaFiles?.length ?? 0} media files>`;
    if (mediaMetadata.tvShow !== undefined) {
        obj.tvShow = `<${mediaMetadata.tvShow.name}>`;
    }
    if (mediaMetadata.movie !== undefined) {
        obj.movie = `<${mediaMetadata.movie.name}>`;
    }
    return JSON.stringify(obj);
}
