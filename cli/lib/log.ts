import type { MediaMetadata } from "@core/types";

function _mediaMetadataSeasonToString(mediaMetadata: MediaMetadata): string {
    const seasons = mediaMetadata.seasons;
    if(undefined === seasons) {
        return ''
    } else {
        let msg = `${seasons.length} seasons, `
        msg += seasons.map(season => `${season.episodes?.length} episodes in season ${season.seasonNumber}`).join(', ')
        return `<` + msg + `>`
    }
}

export function mediaMetadataToString(mediaMetadata: MediaMetadata): string {
    const obj: any = structuredClone(mediaMetadata)
    obj.poster = mediaMetadata.poster === undefined ? undefined : '<hidden>'
    obj.files = mediaMetadata.files === undefined ? undefined : `<${mediaMetadata.files?.length ?? 0} files>`
    obj.mediaFiles = mediaMetadata.mediaFiles === undefined ? undefined : `<${mediaMetadata.mediaFiles?.length ?? 0} files>`
    obj.seasons = mediaMetadata.seasons === undefined ? undefined : _mediaMetadataSeasonToString(mediaMetadata)
    obj.tmdbTvShow = mediaMetadata.tmdbTvShow === undefined ? undefined : `<${mediaMetadata.tmdbTvShow?.name}>`
    obj.tmdbMovie = mediaMetadata.tmdbMovie === undefined ? undefined : `<${mediaMetadata.tmdbMovie?.title}>`
    return JSON.stringify(obj)
}