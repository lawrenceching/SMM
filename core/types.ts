/**
 * Represent the application configuration, which not editable to the user.
 */
export interface AppConfig {
    version: string;
    userDataDir?: string;
}


export type LanguageCode = 'zh-CN' | 'zh-HK' | 'zh-TW' | 'en'

export interface TMDBConfig {
  host?: string
  apiKey?: string
  httpProxy?: string
}

export interface OpenAICompatibleConfig {
  baseURL?: string
  apiKey?: string
  model?: string
}

export interface AIConfig {
  deepseek: OpenAICompatibleConfig
  openAI: OpenAICompatibleConfig
  openrouter: OpenAICompatibleConfig
  glm: OpenAICompatibleConfig
  other: OpenAICompatibleConfig
}

/**
 * Represent the user configuration, which is editable to the user.
 */
export interface UserConfig {
  applicationLanguage: LanguageCode;
  tmdb: TMDBConfig;
  /**
   * The opened media folder paths in SMM. Path is in Platform-specific format.
   */
  folders: string[]
  ai?: AIConfig
  selectedAI?: AI
  selectedTMDBIntance?: TMDBInstance
  /**
   * The name of rename rule
   */
  selectedRenameRule: string
}

/**
 * Request body for POST /api/execute endpoint
 */
export interface ApiExecutePostRequestBody {
  name: string;
  data: any;
}

export interface ReadFileRequestBody {
  path: string;
}

export interface ReadFileResponseBody {
  data?: string;
  error?: string;
}

export interface WriteFileRequestBody {
  /**
   * The absolute path in platform-specific format
   */
  path: string;
  mode: 'overwrite' | 'append' | 'create';
  /**
   * The content to write to the file
   */
  data: string;
}

export interface WriteFileResponseBody {
  error?: string;
}

export interface ListFilesRequestBody {
  /**
   * Absolute path of folder, it could be POSIX path or Windows path
   */
  path: string;

  /**
   * List only file. If onlyFiles and onlyFolders are set to true, ignore the onlyFolders.
   */
  onlyFiles?: boolean;

  /**
   * List only folder. If onlyFiles and onlyFolders are set to true, ignore the onlyFolders.
   */
  onlyFolders?: boolean;

  /**
   * List hidden files. Default is false
   */
  includeHiddenFiles?: boolean;

  /**
   * List all files and folders recursively. Default is false
   */
  recursively?: boolean;
}

export interface ListFilesResponseBody {
  data: {
    /**
     * The resolved path of path parameter in ListFilesRequestBody
     * For example, if user request files in path "~"
     * This field will be "C:\Users\<username>"
     */
    path: string;
    /**
     * List of files and folders in the folder
     */
    items: string[];
  };
  error?: string;
}

export interface ReadImageRequestBody {
  path: string;
}

export interface ReadImageResponseBody {
  /**
   * In a format "data:image:xxxx"
   */
  data?: string;
  error?: string;
}

export type AI = "OpenAI" | "DeepSeek" | "OpenRouter" | "GLM" | "Other"
export type TMDBInstance = "public" | "customized"

export interface RenameRuleVariable {
  type: "buildin" | "javascript"
  name: string,
  description: string,
  example: string,
  fn?: (mediaMetadata: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => string,
  code?: string
}

export const EpisodeNumberVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'EPISODE',
  description: 'The number of episode',
  example: '1, 2, 3, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    return mediaFileMetadata?.episodeNumber?.toString() || '0';
  }
}

export const EpisodeNumberPadded2Variable: RenameRuleVariable = {
  type: "buildin",
  name: 'EPISODE_P2',
  description: 'The number of episode, padded to 2 digits',
  example: '01, 02, 03, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    return mediaFileMetadata?.episodeNumber?.toString().padStart(2, '0') || '00';
  }
}

export const SeasonNumberVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'SEASON',
  description: 'The number of season',
  example: '1, 2, 3, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    return mediaFileMetadata?.seasonNumber?.toString() || '0';
  }
}

export const SeasonNumberPadded2Variable: RenameRuleVariable = {
  type: "buildin",
  name: 'SEASON_P2',
  description: 'The number of season, padded to 2 digits',
  example: '01, 02, 03, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    return mediaFileMetadata?.seasonNumber?.toString().padStart(2, '0') || '';
  }
}

export const SeasonFolderVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'SEASON_FOLDER',
  description: 'The folder name of season',
  example: 'Specials, Season 1, Season 2, Season 3, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    return mediaFileMetadata?.seasonNumber === 0 ? 'Specials' : `Season ${mediaFileMetadata?.seasonNumber?.toString().padStart(2, '0')}`;
  }
}

export const SeasonFolderPadded2Variable: RenameRuleVariable = {
  type: "buildin",
  name: 'SEASON_FOLDER_P2',
  description: 'The folder name of season, padded to 2 digits',
  example: 'Specials, Season 01, Season 02, Season 03, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    return mediaFileMetadata?.seasonNumber === 0 ? 'Specials' : `Season ${mediaFileMetadata?.seasonNumber?.toString().padStart(2, '0')}`;
  }
}

export const TmdbIdVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'TMDB_ID',
  description: 'The TMDB ID of the media',
  example: '123456, 123457, 123458, ...',
  fn: (mediaMetadata: MediaMetadata, _?: MediaFileMetadata) => {
    return mediaMetadata.tmdbTVShowId?.toString() || '0';
  }
}

export const ExtensionVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'EXTENSION',
  description: 'The extension of the media file',
  example: 'mp4, mkv, avi, ...',
  fn: (_: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    if(mediaFileMetadata?.absolutePath.includes('.')) {
      return mediaFileMetadata?.absolutePath.split('.').pop() || '';
    }
    return '';
  }
}

export const NameVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'NAME',
  description: 'The name of episode',
  example: 'The Long Episode, The Long Season, ...',
  fn: (mediaMetadata: MediaMetadata, mediaFileMetadata?: MediaFileMetadata) => {
    // Get episode name from TMDB data if available
    if (mediaFileMetadata?.seasonNumber !== undefined && mediaFileMetadata?.episodeNumber !== undefined) {
      const season = mediaMetadata.tmdbTvShow?.seasons?.find(s => s.season_number === mediaFileMetadata.seasonNumber)
      const episode = season?.episodes?.find(e => e.episode_number === mediaFileMetadata.episodeNumber)
      if (episode?.name) {
        return episode.name
      }
    }
    // Fallback to movie title if it's a movie
    return mediaMetadata.tmdbMovie?.title || '';
  }
}

export const TvShowNameVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'TV_SHOW_NAME',
  description: 'The name of TV show',
  example: 'The Long TV Show, The Long Season, ...',
  fn: (mediaMetadata: MediaMetadata, _?: MediaFileMetadata) => {
    return mediaMetadata.tmdbTvShow?.name || '';
  }
}

export const ReleaseYearVariable: RenameRuleVariable = {
  type: "buildin",
  name: 'RELEASE_YEAR',
  description: 'The name of TV show',
  example: 'The Long TV Show, The Long Season, ...',
  fn: (mediaMetadata: MediaMetadata, _?: MediaFileMetadata) => {
    return mediaMetadata.tmdbTvShow?.first_air_date.split('-')[0] || mediaMetadata.tmdbMovie?.release_date.split('-')[0] || '';
  }
}

export const TmmSeasonFolderNameVariable: RenameRuleVariable = {
  type: "javascript",
  name: 'SEASON_FOLDER_SHORT',
  description: '第0季(特别季) -> se0, 第1季 -> se1, 第2季 -> se2, ...',
  example: '第0季(特别季) -> se0, 第1季 -> se1, 第2季 -> se2, ...',
  code: `\`se\${episode.seasonNumber}\``
}

export const RenameRuleVariables: RenameRuleVariable[] = [
  EpisodeNumberVariable,
  EpisodeNumberPadded2Variable,
  SeasonNumberVariable,
  SeasonNumberPadded2Variable,
  SeasonFolderVariable,
  SeasonFolderPadded2Variable,
  TmdbIdVariable,
  ExtensionVariable,
  NameVariable,
  TvShowNameVariable,
  ReleaseYearVariable,
  TmmSeasonFolderNameVariable
]

export type RenameRuleAuthor = 'system' | 'user'
export type RenameRuleType = 'tv' | 'movie' | 'music' | 'folder'
/**
 * The name uses as ID of RenameRule
 */
export interface RenameRule {
  type: RenameRuleType,
  author: RenameRuleAuthor,
  name: string,
  description: string,
  template: string,
}


export const PlexRenameRule: RenameRule = {
  type: 'tv',
  name: 'Plex(TvShow/Anime)',
  author: 'system',
  description: `例子:

Season 01/天使降临到我身边！ - S01E01 - 心里痒痒的感觉.mkv
Specials/天使降临到我身边！ - S00E01 - OVA 我是姐姐哦.mkv
https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/`,
  template: '{SEASON_FOLDER}/{TV_SHOW_NAME} - S{SEASON_P2}E{EPISODE_P2} - {NAME}.{EXTENSION}',
};

export const PlexMovieRenameRule: RenameRule = {
  type: 'movie',
  name: 'Plex(Movie)',
  author: 'system',
  description: `例子:
蝙蝠侠：黑暗骑士 (2018).mkv
https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/`,
  template: '{NAME} ({RELEASE_YEAR}).{EXTENSION}',
};

export const TvShowShortSeasonFolderRenameRule: RenameRule = {
  type: 'tv',
  name: 'TMM(TvShow/Anime)',
  author: 'system',
  description: `例子:
se0/天使降临到我身边！ - S00E01 - OVA 我是姐姐哦.mkv
se1/天使降临到我身边！ - S01E01 - 心里痒痒的感觉.mkv
`,
  template: '{SEASON_FOLDER_SHORT}/{TV_SHOW_NAME} - S{SEASON_P2}E{EPISODE_P2} - {NAME}.{EXTENSION}',
}

export const EmbyFolderRenameRule: RenameRule = {
  type: 'folder',
  name: 'Emby(TMDB ID 后缀)',
  author: 'system',
  description: `
https://emby.media/support/articles/TV-Naming.html`,
  template: '{TV_SHOW_NAME} ({RELEASE_YEAR}) [tmdbid={TMDB_ID}]',
};

export const RenameRules = {
  Plex: PlexRenameRule,
  PlexMovie: PlexMovieRenameRule,
  EmbyFolder: EmbyFolderRenameRule,
  TvShowShortSeasonFolder: TvShowShortSeasonFolderRenameRule,
}


export interface TvShowEpisodeMetadata {
  seasonNumber: number,
  episodeNumber: number,
  episodeName: string,
}

export interface TvShowSeasonMetadata {
    seasonNumber: number,
    seasonName: string,
    seasonTitle: string,
    episodes: TvShowEpisodeMetadata[]
}

/**
  * Stores the recognised media file that it is for what season and what episode
  */
export interface MediaFileMetadata {
  /**
   * POSIX format path for video file of TV Show episode or Movie
   */
  absolutePath: string,
  /**
   * Only available for TV Show media files
   */
  seasonNumber?: number,

  /**
   * Only available for TV Show media files
   */
  episodeNumber?: number,
}

export type TMDBMediaType = 'movie' | 'tv'

export interface MediaMetadata {
  /**
   * The offical title or name.
   * @deprecated use tmdbTvShow.name instead
   */
  officalMediaName?: string,

  /**
   * The name of media, it's not realiable, it may come from folder name, AI guessed name, or user input name
   * @deprecated use tmdbTvShow.name instead
   */
  mediaName?: string,

  /**
   * The absolute path of media folder, in POSIX format
   */
  mediaFolderPath?: string,

  /**
   * The absolute paths of files (all files, media files, subtitle files, poster files, etc.) in media folder
   * The path is in POSIX format
   * string[] - the files in the folder, empyt array means there is no files in the folder.
   * null - the folder is not existed
   * undefined - the files was not set, does not reflect to the actual state of the folder
   * This value should not persist in file cache, SMM will load local files everytime it loads media metadata.
   */
  files?: string[] | null | undefined,

  // TODO: change tmdbTVShowId to tmdbId, need to consider the backward compatibility as user may already have metadata saved with tmdbTVShowId
  /**
   * @deprecated use tmdbTvShow.id instead
   */
  tmdbTVShowId?: number,

  /**
   * @deprecated use tmdbTvShow.seasons instead
   */
  seasons?: TvShowSeasonMetadata[],

  /**
   * The BASE64 encoded image data 
   * @deprecated use tmdbTvShow.poster_path instead
   */
  poster?: string,

  /**
   * Stores the recognised media files
   */
  mediaFiles?: MediaFileMetadata[],
  /**
   * @deprecated
   */
  tmdbMediaType?: TMDBMediaType,
  type?: "music-folder" | "tvshow-folder" | "movie-folder"

  tmdbTvShow?: TMDBTVShowDetails,
  tmdbMovie?: TMDBMovie,
}

// TMDB Search Types
export type TMDBSearchType = 'movie' | 'tv' 

// TMDB API Response Models
export interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  popularity: number
  genre_ids: number[]
  adult: boolean
  video: boolean
  media_type?: 'movie'
}

export interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  popularity: number
  genre_ids: number[]
  origin_country: string[]
  media_type?: 'tv'
}

export interface TMBDPerson {
  id: number
  name: string
  profile_path: string | null
  adult: boolean
  popularity: number
  known_for_department: string
  gender: number
  known_for: Array<TMDBMovie | TMDBTVShow>
  media_type?: 'person'
}

export interface TMDBCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
  media_type?: 'company'
}

export interface TMDBCollection {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
  media_type?: 'collection'
}

export interface TMDBKeyword {
  id: number
  name: string
  media_type?: 'keyword'
}

// TV Show Details Interfaces
export interface TMDBTVShowDetails extends TMDBTVShow {
  number_of_seasons: number
  number_of_episodes: number
  seasons: TMDBSeason[]
  status: string
  type: string
  in_production: boolean
  last_air_date: string
  networks: Array<{
    id: number
    name: string
    logo_path: string | null
  }>
  production_companies: Array<{
    id: number
    name: string
    logo_path: string | null
  }>
}

export interface TMDBSeason {
  id: number
  name: string
  overview: string
  poster_path: string | null
  season_number: number
  air_date: string
  episode_count: number
  episodes?: TMDBEpisode[]
}

export interface TMDBEpisode {
  id: number
  name: string
  overview: string
  still_path: string | null
  air_date: string
  episode_number: number
  season_number: number
  vote_average: number
  vote_count: number
  runtime: number
}


export interface ReadMediaMetadataRequestBody {
  /**
   * Absolute path of media folder in platform-specific format
   */
  path: string;
}

export interface ReadMediaMetadataResponseBody {
  data?: MediaMetadata;
  error?: string;
}

export interface WriteMediaMetadataRequestBody {
  data: MediaMetadata;
}

export interface WriteMediaMetadataResponseBody {
  data: MediaMetadata;
  error?: string;
}

export interface DeleteMediaMetadataResponseBody {
  error?: string;
}

export interface DeleteMediaMetadataRequestBody {
  /**
   * Absolute path of media folder in platform-specific format
   */
  path: string;
}

/**
 * RFC 9457 Problem Details for HTTP APIs
 *   https://www.rfc-editor.org/rfc/rfc9457.html
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface TmdbSearchRequestBody {
  keyword: string, 
  type: "movie" | "tv", 
  language: 'zh-CN' | 'en-US' | 'ja-JP',
  baseURL?: string
}

export interface TmdbSearchResponseBody {
  results: Array<TMDBMovie | TMDBTVShow>
  page: number
  total_pages: number
  total_results: number
  error?: string
}

export interface TmdbMovieResponseBody {
  data?: TMDBMovie
  error?: string
}

export interface TmdbTvShowResponseBody {
  data?: TMDBTVShowDetails
  error?: string
}

export interface OpenAIGenerateObjectRequestBody {
  baseURL: string
  apiKey: string
  model: string
  prompt: string
}

export interface OpenAIGenerateObjectResponseBody {
  data: any
  error?: string
}

/**
 * Record the result of local media file matching to corresponding seasons and episodes
 */
export interface MediaFileMatchResult {
  path: string
  seasonNumber: string
  episodeNumber: string
}

export interface DownloadImageRequestBody {
  url: string
  /**
   * The absolute path in platform format
   */
  path: string
}

export interface DownloadImageResponseBody {
  data: {
    url: string
    path: string
  }
  error?: string
}

export interface OpenInFileManagerRequestBody {
  /**
   * The absolute path to the folder to open
   */
  path: string
}

export interface OpenInFileManagerResponseBody {
  data: {
    path: string
  }
  error?: string
}

export interface ScrapeRequestBody {
  /**
   * The absolute path to the media folder (in POSIX format)
   */
  mediaFolderPath: string;
}

export interface ScrapeResponseBody {
  error?: string;
}

export interface HelloResponseBody {
  /**
   * application uptime in seconds
   */
  uptime: number;
  version: string;

  /**
   * path in platform-specific format
   */
  userDataDir: string;

  /**
   * path in platform-specific format
   */
  appDataDir: string;
}

export interface FileRenameRequestBody {
  /**
   * Absolute path of media folder
   */
  mediaFolder: string;
  /**
   * Absolute path of source file
   */
  from: string;
  /**
   * Absolute path of destination
   */
  to: string;
}


export interface FileRenameResponseBody {
  error?: string
}

export interface FolderRenameRequestBody {
  /**
   * Absolute path of source folder
   */
  from: string;
  /**
   * Absolute path of destination folder
   */
  to: string;
}

export interface FolderRenameResponseBody {
  error?: string
}

export interface FileRenameInBatchRequestBody {
  /**
   * Absolute path of media folder
   */
  mediaFolder: string;
  /**
   * Array of file rename operations
   */
  files: Array<{
    /**
     * Absolute path of source file
     */
    from: string;
    /**
     * Absolute path of destination
     */
    to: string;
  }>;
}

export interface FileRenameInBatchResponseBody {
  error?: string;
}

export interface NewFileNameRequestBody {
  ruleName: "plex" | "emby",
  type: "tv" | "movie";
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  tvshowName: string;
  file: string;
  tmdbId: string;
  releaseYear: string; 
  movieName?: string;
}

export interface GetFileNameResponseBody {
  /**
   * The new file name, generally it's a relative path
   */
  data: string
  error?: string
}