export interface Format {
    url: string
    ext: string
    format_id: string
    format: string
    protocol: string
    vcodec: string | null
    acodec: string | null
    vbr: number | null
    abr: number | null
    tbr: number | null
    width: number | null
    height: number | null
    resolution: string | null
    aspect_ratio: number | null
    fps: number | null
    dynamic_range: string | null
    quality: number | null
    filesize: number | null
    filesize_approx: number | null
    audio_ext: string | null
    video_ext: string | null
    http_headers: Record<string, string>
}

export interface Thumbnail {
    url: string
    id: string
}

export interface RequestedDownload {
    requested_formats: Format[]
    format: string
    format_id: string
    ext: string
    protocol: string
    filesize_approx: number | null
    tbr: number | null
    width: number | null
    height: number | null
    resolution: string | null
    fps: number | null
    dynamic_range: string | null
    vcodec: string | null
    vbr: number | null
    aspect_ratio: number | null
    acodec: string | null
    abr: number | null
}

export interface Version {
    version: string
    current_git_head: string | null
    release_git_head: string | null
    repository: string
}

export interface VideoMetadata {
    id: string
    title: string
    fulltitle: string | null
    display_id: string
    description: string | null
    uploader: string | null
    uploader_id: string | null
    thumbnail: string | null
    thumbnails: Thumbnail[]
    duration: number | null
    duration_string: string | null
    timestamp: number | null
    upload_date: string | null
    release_year: number | null
    epoch: number
    view_count: number | null
    like_count: number | null
    comment_count: number | null
    tags: string[] | null
    chapters: unknown | null
    subtitles: Record<string, unknown>
    requested_subtitles: unknown | null
    webpage_url: string | null
    original_url: string | null
    webpage_url_basename: string
    webpage_url_domain: string
    extractor: string | null
    extractor_key: string | null
    http_headers: Record<string, string>
    _old_archive_ids: string[] | null
    _has_drm: boolean | null

    // Selected format info
    format: string | null
    format_id: string | null
    ext: string | null
    protocol: string | null
    width: number | null
    height: number | null
    resolution: string | null
    fps: number | null
    dynamic_range: string | null
    vcodec: string | null
    acodec: string | null
    vbr: number | null
    abr: number | null
    tbr: number | null
    aspect_ratio: number | null
    stretched_ratio: number | null
    filesize_approx: number | null
    language: string | null
    format_note: string | null
    asr: number | null
    audio_channels: number | null

    formats: Format[]
    requested_formats: Format[] | null
    requested_downloads: RequestedDownload[]

    // Playlist context (present on playlist entries)
    playlist: string | null
    playlist_id: string | null
    playlist_title: string | null
    playlist_uploader: string | null
    playlist_uploader_id: string | null
    playlist_channel: string | null
    playlist_channel_id: string | null
    playlist_webpage_url: string | null
    playlist_count: number | null
    n_entries: number | null
    playlist_index: number | null
    __last_playlist_index: number | null
    playlist_autonumber: number | null

    // Single-video top-level only
    _type?: string
    _version?: Version
}

export interface PlaylistMetadata {
    id: string
    title: string
    _type: string
    entries: VideoMetadata[]
    webpage_url: string | null
    original_url: string | null
    webpage_url_basename: string | null
    webpage_url_domain: string | null
    extractor: string | null
    extractor_key: string | null
    release_year: number | null
    playlist_count: number | null
    epoch: number
    __files_to_move?: Record<string, unknown>
    _version: Version
}
