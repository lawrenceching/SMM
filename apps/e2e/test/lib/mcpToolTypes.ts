/**
 * MCP tool request/response shapes for e2e `McpClient`.
 * Keep in sync with packages/core-routes MCP handlers and apps/cli/src/mcp/mcp.ts registrations.
 */

import type { TmdbMovieDetails, TmdbSeriesDetails } from '@smm/core/types'

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
  scrape: 'scrape',
  getJob: 'get-job',
  beginRenameFilesTask: 'begin-rename-files-task',
  addRenameFileToTask: 'add-rename-file-to-task',
  endRenameFilesTask: 'end-rename-files-task',
  beginRecognizeTask: 'begin-recognize-task',
  addRecognizedFile: 'add-recognized-media-file',
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
  source: 'TMDB' | 'TVDB'
  id: number
  name: string
  seasons: GetMediaMetadataTvShowSeason[]
}

export interface GetMediaMetadataTmdbMovieData {
  tmdbId: number
  title: string
  originalTitle: string
  overview: string
  releaseDate: string
  posterPath: string | null
}

export interface GetMediaMetadataTvdbMovieData {
  tvdbId: number
  name: string
  database: 'TMDB' | 'TVDB'
}

export interface GetMediaMetadataData {
  mediaFolderPath: string
  type: 'tvshow-folder' | 'movie-folder' | 'music-folder'
  tvShow?: GetMediaMetadataTvShowData | string
  tmdbMovie?: GetMediaMetadataTmdbMovieData | string
  tvdbMovie?: GetMediaMetadataTvdbMovieData | string
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

// --- scrape ---
export interface ScrapeRequest {
  path: string
  language?: string
}

export interface ScrapeResponse {
  id: string
  message: string
  error?: string
}

// --- get-job ---
export interface GetJobRequest {
  id: string
}

export interface GetJobScrapeTask {
  status: string
  error?: string
}

export interface GetJobScrapeJob {
  kind: 'scrape'
  id: string
  folderPath: string
  status: string
  tasks: {
    poster: GetJobScrapeTask
    fanart: GetJobScrapeTask
    thumbnails: GetJobScrapeTask
    nfo: GetJobScrapeTask
  }
  error?: string
  createdAt: number
  updatedAt: number
}

export interface GetJobImportJob {
  kind: 'import'
  id: string
  folderPath: string
  type: string
  status: string
  stage: string | null
  progress: number
  recognizedTitle?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export interface GetJobResponse {
  job?: GetJobScrapeJob | GetJobImportJob
  error?: string
}

// --- rename task (begin/append/end) ---
export interface BeginRenameFilesTaskRequest {
  mediaFolderPath: string
}

export interface BeginRenameFilesTaskResponse {
  success: boolean
  taskId: string
  mediaFolderPath: string
}

export interface AddRenameFileToTaskRequest {
  taskId: string
  from: string
  to: string
}

export interface AddRenameFileToTaskResponse {
  success?: boolean
}

export interface EndRenameFilesTaskRequest {
  taskId: string
}

export interface EndRenameFilesTaskResponse {
  success: boolean
  taskId: string
  message?: string
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

export interface TmdbSearchTvResult {
  id: number
  name?: string
}

export interface TmdbSearchResponse {
  results: TmdbSearchTvResult[]
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

/**
 * MCP `tmdb-get-movie` prints the JSON of `createSuccessResponse(getMovie(...))`, i.e. the
 * {@link TmdbMovieDetails} shape.
 */
export type TmdbMovieDetailsResponse = TmdbMovieDetails

/**
 * MCP `tmdb-get-tv-show` returns {@link TmdbSeriesDetails} from Core (flat TMDB TV details).
 */
export type TmdbTvShowDetailsResponse = TmdbSeriesDetails
