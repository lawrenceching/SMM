/** HTTP headers object as emitted by yt-dlp (keys vary by context). */
export type YtdlpHttpHeaders = Record<string, string>;

/** Single stream / merged format entry from yt-dlp `-J` output. */
export interface YtdlpFormat {
    url: string;
    ext: string;
    acodec: string;
    vcodec: string;
    tbr: number;
    filesize: number | null;
    format_id: string;
    protocol: string;
    audio_ext: string;
    video_ext: string;
    vbr: number;
    abr: number;
    resolution: string;
    aspect_ratio: number | null;
    filesize_approx: number;
    http_headers: YtdlpHttpHeaders;
    /** Human-readable label, e.g. quality name or "30232 - audio only". */
    format?: string;
    fps?: number;
    width?: number;
    height?: number;
    dynamic_range?: string;
    quality?: number;
}

export interface YtdlpThumbnail {
    url: string;
    id: string;
}

export interface YtdlpVersionInfo {
    version: string;
    current_git_head: string | null;
    release_git_head: string;
    repository: string;
}

/**
 * Shape of yt-dlp JSON for a single video, as in
 * `docs/ytdlp/bilibili-data-extraction-example.json` (BiliBili extractor).
 */
export interface YtdlpVideo {
    uploader: string;
    uploader_id: string;
    like_count: number;
    tags: string[];
    thumbnail: string;
    description: string;
    timestamp: number;
    view_count: number;
    comment_count: number;
    id: string;
    _old_archive_ids: string[];
    title: string;
    http_headers: YtdlpHttpHeaders;
    formats: YtdlpFormat[];
    duration: number;
    chapters: unknown[] | null;
    subtitles: Record<string, unknown>;
    webpage_url: string;
    original_url: string;
    webpage_url_basename: string;
    webpage_url_domain: string;
    extractor: string;
    extractor_key: string;
    playlist_count: number;
    playlist: string;
    playlist_id: string;
    playlist_title: string;
    playlist_uploader: string | null;
    playlist_uploader_id: string | null;
    playlist_channel: string | null;
    playlist_channel_id: string | null;
    playlist_webpage_url: string;
    n_entries: number;
    playlist_index: number;
    __last_playlist_index: number;
    playlist_autonumber: number;
    thumbnails: YtdlpThumbnail[];
    display_id: string;
    fulltitle: string;
    duration_string: string;
    upload_date: string;
    release_year: number | null;
    requested_subtitles: unknown | null;
    _has_drm: boolean | null;
    epoch: number;
    requested_formats: YtdlpFormat[];
    format: string;
    format_id: string;
    ext: string;
    protocol: string;
    language: string | null;
    format_note: string | null;
    filesize_approx: number;
    tbr: number;
    width: number;
    height: number;
    resolution: string;
    fps: number;
    dynamic_range: string;
    vcodec: string;
    vbr: number;
    stretched_ratio: number | null;
    aspect_ratio: number;
    acodec: string;
    abr: number;
    asr: number | null;
    audio_channels: number | null;
    _filename: string;
    filename: string;
    _type: string;
    _version: YtdlpVersionInfo;
}
