import type { UserConfig } from "@smm/types";

export const DEFAULT_USER_CONFIG: UserConfig = {
  folders: [],
  tmdb: {},
  tvdb: {},
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "plex",
};

/** Exhaustive UserConfig keys; adding a field to UserConfig without updating this fails typecheck. */
export const USER_CONFIG_KEY_FLAGS = {
  applicationLanguage: true,
  tmdb: true,
  tvdb: true,
  primaryDatabase: true,
  preferMediaLanguage: true,
  folders: true,
  selectedFolder: true,
  renameRules: true,
  dryRun: true,
  ai: true,
  selectedAI: true,
  aiProviders: true,
  selectedAIProvider: true,
  selectedTMDBIntance: true,
  selectedRenameRule: true,
  enableMcpServer: true,
  mcpHost: true,
  mcpPort: true,
  anonymousTelemetryConsent: true,
  ytdlpExecutablePath: true,
  ytdlpProxy: true,
  ffmpegExecutablePath: true,
  videoCaptionerExecutablePath: true,
  useBundledFfmpegForVideoCaptioner: true,
  quickjsExecutablePath: true,
} as const satisfies { [K in keyof UserConfig]: true };

export const USER_CONFIG_KEYS = Object.keys(USER_CONFIG_KEY_FLAGS) as (keyof UserConfig)[];

export function isUserConfigKey(key: string): key is keyof UserConfig {
  return Object.prototype.hasOwnProperty.call(USER_CONFIG_KEY_FLAGS, key);
}
