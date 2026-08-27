import type { MediaFileMetadata, MediaMetadata } from "@smm/core";

const MEDIA_FOLDER_TYPES = ["music-folder", "tvshow-folder", "movie-folder"] as const;

/** Media metadata persisted on disk; {@link MediaMetadata.files} is never stored. */
export type PersistedMediaMetadata = Omit<MediaMetadata, "files">;

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function validateMediaFileMetadata(value: unknown, index: number): MediaFileMetadata {
  const obj = assertObject(value, `mediaFiles[${index}]`);
  if (typeof obj.absolutePath !== "string" || !obj.absolutePath.trim()) {
    throw new Error(`mediaFiles[${index}].absolutePath must be a non-empty string`);
  }
  const entry: MediaFileMetadata = { absolutePath: obj.absolutePath };
  if (obj.seasonNumber !== undefined) {
    if (typeof obj.seasonNumber !== "number" || !Number.isInteger(obj.seasonNumber)) {
      throw new Error(`mediaFiles[${index}].seasonNumber must be an integer`);
    }
    entry.seasonNumber = obj.seasonNumber;
  }
  if (obj.episodeNumber !== undefined) {
    if (typeof obj.episodeNumber !== "number" || !Number.isInteger(obj.episodeNumber)) {
      throw new Error(`mediaFiles[${index}].episodeNumber must be an integer`);
    }
    entry.episodeNumber = obj.episodeNumber;
  }
  return entry;
}

/** Validates metadata before persist; strips deprecated `files` when present. */
export function validatePersistedMediaMetadata(value: unknown): PersistedMediaMetadata {
  const obj = assertObject(value, "MediaMetadata");

  const mediaFolderPath = obj.mediaFolderPath;
  if (typeof mediaFolderPath !== "string" || !mediaFolderPath.trim()) {
    throw new Error("mediaFolderPath is required");
  }

  let type: PersistedMediaMetadata["type"];
  if (obj.type !== undefined) {
    if (typeof obj.type !== "string" || !(MEDIA_FOLDER_TYPES as readonly string[]).includes(obj.type)) {
      throw new Error(`type must be one of: ${MEDIA_FOLDER_TYPES.join(", ")}`);
    }
    type = obj.type as PersistedMediaMetadata["type"];
  }

  let mediaFiles: MediaFileMetadata[] | undefined;
  if (obj.mediaFiles !== undefined) {
    if (!Array.isArray(obj.mediaFiles)) {
      throw new Error("mediaFiles must be an array");
    }
    mediaFiles = obj.mediaFiles.map((entry, index) => validateMediaFileMetadata(entry, index));
  }

  const result: PersistedMediaMetadata = {
    mediaFolderPath,
    ...(type !== undefined ? { type } : {}),
    ...(mediaFiles !== undefined ? { mediaFiles } : {}),
  };

  if (obj.tvShow !== undefined) {
    if (obj.tvShow === null || typeof obj.tvShow !== "object" || Array.isArray(obj.tvShow)) {
      throw new Error("tvShow must be an object");
    }
    result.tvShow = obj.tvShow as PersistedMediaMetadata["tvShow"];
  }

  if (obj.movie !== undefined) {
    if (obj.movie === null || typeof obj.movie !== "object" || Array.isArray(obj.movie)) {
      throw new Error("movie must be an object");
    }
    result.movie = obj.movie as PersistedMediaMetadata["movie"];
  }

  return result;
}

/** Removes deprecated `files` from loaded metadata. */
export function stripDeprecatedFiles(mm: MediaMetadata): PersistedMediaMetadata {
  const { files: _files, ...rest } = mm;
  return rest;
}
