import { Path } from "@smm/utils/path";
import { Mutex } from "es-toolkit";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath } from "./paths";
import {
  stripDeprecatedFiles,
  validatePersistedMediaMetadata,
  type PersistedMediaMetadata,
} from "./mediaMetadataValidation";

const writeMutexByPath = new Map<string, Mutex>();

function writeMutexFor(path: string): Mutex {
  const existing = writeMutexByPath.get(path);
  if (existing) return existing;
  const created = new Mutex();
  writeMutexByPath.set(path, created);
  return created;
}

async function withWriteLocks(paths: string[], fn: () => Promise<void>): Promise<void> {
  const uniqueSorted = [...new Set(paths)].sort();
  const acquired: Mutex[] = [];
  try {
    for (const path of uniqueSorted) {
      const mutex = writeMutexFor(path);
      await mutex.acquire();
      acquired.push(mutex);
    }
    await fn();
  } finally {
    for (let i = acquired.length - 1; i >= 0; i--) {
      acquired[i]!.release();
    }
  }
}

/** Invoked after a metadata cache file is successfully written, moved, or deleted. */
export type MediaMetadataUpdatedListener = (folderPath: string) => void;

/** Write-locked reader/writer for `{appDataDir}/metadata/*.json` cache files. */
export class MediaMetadataHelper {
  constructor(
    private readonly fs: FsPort,
    private readonly appDataDir: string,
    private readonly onUpdated?: MediaMetadataUpdatedListener,
  ) {}

  cachePath(folder: string): string {
    return metadataCachePath(this.appDataDir, this.normalizeFolder(folder));
  }

  /** Reads metadata for a folder; null when absent or corrupt. Never returns `files`. */
  async read(folder: string): Promise<PersistedMediaMetadata | null> {
    const cachePath = this.cachePath(folder);
    if (!(await this.fs.exists(cachePath))) return null;
    try {
      const content = await this.fs.readTextFile(cachePath);
      const parsed = JSON.parse(content) as PersistedMediaMetadata;
      return stripDeprecatedFiles(parsed);
    } catch {
      return null;
    }
  }

  /** Validates and replaces the metadata cache for `metadata.mediaFolderPath`. */
  async write(metadata: PersistedMediaMetadata): Promise<void> {
    const validated = validatePersistedMediaMetadata(metadata);
    const folderPath = validated.mediaFolderPath!;
    const cachePath = this.cachePath(folderPath);
    await withWriteLocks([cachePath], async () => {
      await this.fs.writeTextFile(cachePath, JSON.stringify(validated, null, 2));
    });
    this.notify(folderPath);
  }

  /** Creates metadata only when no cache file exists. */
  async createIfAbsent(
    metadata: PersistedMediaMetadata,
  ): Promise<PersistedMediaMetadata | null> {
    const validated = validatePersistedMediaMetadata(metadata);
    const folderPath = validated.mediaFolderPath!;
    const cachePath = this.cachePath(folderPath);
    let result: PersistedMediaMetadata | null = null;
    await withWriteLocks([cachePath], async () => {
      if (await this.fs.exists(cachePath)) return;
      await this.fs.writeTextFile(cachePath, JSON.stringify(validated, null, 2));
      result = validated;
    });
    if (result) this.notify(folderPath);
    return result;
  }

  /** Updates an existing valid cache atomically; null when absent or corrupt. */
  async updateIfPresent(
    folder: string,
    mutator: (current: PersistedMediaMetadata) => PersistedMediaMetadata,
  ): Promise<PersistedMediaMetadata | null> {
    const folderPath = this.normalizeFolder(folder);
    const cachePath = this.cachePath(folderPath);
    let result: PersistedMediaMetadata | null = null;
    await withWriteLocks([cachePath], async () => {
      const current = await this.readUnlocked(folderPath);
      if (!current) return;
      const validated = validatePersistedMediaMetadata(mutator(current));
      await this.fs.writeTextFile(cachePath, JSON.stringify(validated, null, 2));
      result = validated;
    });
    if (result) this.notify(folderPath);
    return result;
  }

  async update(
    folder: string,
    mutator: (current: PersistedMediaMetadata) => PersistedMediaMetadata,
  ): Promise<PersistedMediaMetadata> {
    const folderPath = this.normalizeFolder(folder);
    const cachePath = this.cachePath(folderPath);
    let result!: PersistedMediaMetadata;
    let wrote = false;
    await withWriteLocks([cachePath], async () => {
      const current = (await this.readUnlocked(folderPath)) ?? {
        mediaFolderPath: folderPath,
      };
      const next = mutator(current);
      if (next === current) {
        result = current;
        return;
      }
      const validated = validatePersistedMediaMetadata(next);
      await this.fs.writeTextFile(cachePath, JSON.stringify(validated, null, 2));
      result = validated;
      wrote = true;
    });
    if (wrote) this.notify(folderPath);
    return result;
  }

  /** Deletes the metadata cache for a folder. Idempotent. */
  async delete(folder: string): Promise<void> {
    const folderPath = this.normalizeFolder(folder);
    const cachePath = this.cachePath(folderPath);
    if (!(await this.fs.exists(cachePath))) return;
    await withWriteLocks([cachePath], async () => {
      if (await this.fs.exists(cachePath)) {
        await this.fs.deleteFile(cachePath);
      }
    });
    this.notify(folderPath);
  }

  /** Moves metadata from one cache file to another under write lock. */
  async move(fromFolder: string, toFolder: string, metadata: PersistedMediaMetadata): Promise<void> {
    const fromPath = this.cachePath(fromFolder);
    const toPath = this.cachePath(toFolder);
    const fromPosix = this.normalizeFolder(fromFolder);
    const toPosix = this.normalizeFolder(toFolder);
    const validated = validatePersistedMediaMetadata(metadata);
    await withWriteLocks([fromPath, toPath], async () => {
      await this.fs.writeTextFile(toPath, JSON.stringify(validated, null, 2));
      if (fromPath !== toPath && (await this.fs.exists(fromPath))) {
        await this.fs.deleteFile(fromPath);
      }
    });
    this.notify(toPosix);
    if (fromPosix !== toPosix) this.notify(fromPosix);
  }

  private notify(folderPath: string): void {
    this.onUpdated?.(this.normalizeFolder(folderPath));
  }

  private normalizeFolder(folder: string): string {
    try {
      return Path.posix(folder);
    } catch {
      return folder;
    }
  }

  private async readUnlocked(folder: string): Promise<PersistedMediaMetadata | null> {
    const cachePath = this.cachePath(folder);
    if (!(await this.fs.exists(cachePath))) return null;
    try {
      const content = await this.fs.readTextFile(cachePath);
      return stripDeprecatedFiles(JSON.parse(content) as PersistedMediaMetadata);
    } catch {
      return null;
    }
  }
}
