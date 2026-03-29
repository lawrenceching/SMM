/**
 * MCP tool request/response shapes for e2e `McpClient`.
 * Keep in sync with apps/cli/src/tools and apps/cli/src/mcp/tools (see mcp.ts registrations).
 */

/** Kebab-case names passed to `mcp-test-client --tool`. */
export const McpToolName = {
  getAppContext: 'get-app-context',
  getMediaFolders: 'get-media-folders',
  isFolderExist: 'is-folder-exist',
  listFiles: 'list-files',
  getMediaMetadata: 'get-media-metadata',
  readme: 'readme',
  howToRenameEpisodeVideoFiles: 'how-to-rename-episode-video-files',
  howToRecognizeEpisodeVideoFiles: 'how-to-recognize-episode-video-files',
  renameFolder: 'rename-folder',
  beginRenameEpisodeVideoFileTask: 'begin-rename-episode-video-file-task',
  addRenameEpisodeVideoFile: 'add-rename-episode-video-file',
  endRenameEpisodeVideoFileTask: 'end-rename-episode-video-file-task',
  beginRecognizeTask: 'begin-recognize-task',
  addRecognizedFile: 'add-recognized-file',
  endRecognizeTask: 'end-recognize-task',
  getEpisode: 'get-episode',
  getEpisodes: 'get-episodes',
  tmdbSearch: 'tmdb-search',
  tmdbGetMovie: 'tmdb-get-movie',
  tmdbGetTvShow: 'tmdb-get-tv-show',
} as const

export type McpToolNameValue = (typeof McpToolName)[keyof typeof McpToolName]

// --- get-app-context ---
export interface GetAppContextResponse {
  selectedMediaFolder: string
  language: string
}

// --- get-media-folders ---
export interface GetMediaFoldersResponse {
  folders: string[]
}

// --- is-folder-exist ---
export interface IsFolderExistRequest {
  path: string
}

export interface IsFolderExistResponse {
  exists: boolean
  path: string
  reason?: string
}

// --- list-files ---
export interface ListFilesRequest {
  folderPath: string
  recursive?: boolean
  filter?: string
  videoFileOnly?: boolean
}

export interface ListFilesResponse {
  files: string[]
  count: number
}

// --- get-media-metadata ---
export interface GetMediaMetadataRequest {
  mediaFolderPath: string
}

export interface GetMediaMetadataTvShowEpisode {
  seasonNumber: number
  episodeNumber: number
  episodeName: string
}

export interface GetMediaMetadataTvShowSeason {
  seasonNumber: number
  seasonName: string
  episodes: GetMediaMetadataTvShowEpisode[]
}

export interface GetMediaMetadataTvShowData {
  tmdbId: number
  name: string
  seasons: GetMediaMetadataTvShowSeason[]
}

export interface GetMediaMetadataData {
  mediaFolderPath: string
  type: 'tvshow-folder' | 'movie-folder' | 'music-folder'
  tmdbTvShow?: GetMediaMetadataTvShowData | string
}

export interface GetMediaMetadataResponse {
  data: GetMediaMetadataData
  error?: string
}

// --- readme / how-to markdown tools ---
export interface MarkdownTextResponse {
  text: string
}

// --- rename-folder ---
export interface RenameFolderRequest {
  from: string
  to: string
}

export interface RenameFolderResponse {
  renamed: boolean
  from: string
  to: string
  error?: string
}

// --- rename task (begin/append/end) ---
export interface BeginRenameEpisodeVideoFileTaskRequest {
  mediaFolderPath: string
}

export interface BeginRenameEpisodeVideoFileTaskResponse {
  success: boolean
  taskId: string
  mediaFolderPath?: string
}

export interface AddRenameEpisodeVideoFileRequest {
  taskId: string
  from: string
  to: string
}

export interface AddRenameEpisodeVideoFileResponse {
  success: boolean
  taskId: string
}

export interface EndRenameEpisodeVideoFileTaskRequest {
  taskId: string
}

export interface EndRenameEpisodeVideoFileTaskResponse {
  success: boolean
  taskId: string
  fileCount?: number
  error?: string
}

// --- recognize task ---
export interface BeginRecognizeTaskRequest {
  mediaFolderPath: string
}

export interface BeginRecognizeTaskResponse {
  success: boolean
  taskId: string
  mediaFolderPath?: string
}

export interface AddRecognizedFileRequest {
  taskId: string
  season: number
  episode: number
  path: string
}

export interface AddRecognizedFileResponse {
  success: boolean
  taskId: string
}

export interface EndRecognizeTaskRequest {
  taskId: string
}

export interface EndRecognizeTaskResponse {
  success: boolean
  taskId: string
  fileCount?: number
  error?: string
}

// --- get-episode / get-episodes ---
export interface GetEpisodeRequest {
  mediaFolderPath: string
  season: number
  episode: number
}

export interface GetEpisodeResponse {
  videoFilePath: string
  season: number
  episode: number
  message: string
}

export interface GetEpisodesRequest {
  mediaFolderPath: string
}

export interface GetEpisodesEpisodeItem {
  season: number
  episode: number
  videoFilePath?: string
}

export interface GetEpisodesResponse {
  episodes: GetEpisodesEpisodeItem[]
  totalCount: number
  showName: string
  numberOfSeasons: number
}

// --- TMDB ---
export interface TmdbSearchRequest {
  keyword: string
  type: 'movie' | 'tv'
  language?: 'zh-CN' | 'en-US' | 'ja-JP'
  baseURL?: string
}

export interface TmdbSearchResponse {
  results: unknown[]
  page: number
  total_pages: number
  total_results: number
}

export interface TmdbGetMovieRequest {
  id: number
  language?: 'zh-CN' | 'en-US' | 'ja-JP'
  baseURL?: string
}

export interface TmdbGetTvShowRequest {
  id: number
  language?: 'zh-CN' | 'en-US' | 'ja-JP'
  baseURL?: string
}

/** TMDB payload varies; use `unknown` for strict callers or narrow at call site. */
export type TmdbMovieDetailsResponse = Record<string, unknown>
export type TmdbTvShowDetailsResponse = Record<string, unknown>
