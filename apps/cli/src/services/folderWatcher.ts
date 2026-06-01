import { watch, type FSWatcher } from 'fs';
import { broadcast } from '../utils/socketIO';
import { FOLDER_CONTENT_CHANGED_EVENT } from '@core/event-types';
import { Path } from '@core/path';
import pino from 'pino';

const logger = pino();

/** Default debounce delay in ms */
const DEFAULT_DEBOUNCE_MS = 500;

/** File name patterns to ignore (case-insensitive). */
const IGNORE_PATTERNS = [
  /^\./,           // dotfiles (.DS_Store, .hidden, etc.)
  /^~/,            // temp files (~filename)
  /\.tmp$/i,       // .tmp files
  /\.temp$/i,      // .temp files
  /\.swp$/i,       // vim swap files
  /\.swpx$/i,      // vim swap files
  /~$/,            // emacs backup files
  /^Thumbs\.db$/i, // Windows thumbnail cache
  /^\.nfs/,        // NFS temporary files
];

/**
 * Check if a filename should be ignored (dotfiles, temp files, etc.)
 */
function shouldIgnore(filename: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(filename));
}

interface PendingChange {
  folderPath: string
  changeType: 'created' | 'modified' | 'deleted'
  filePath?: string
  timestamp: number
}

/**
 * Manages fs.watch on media folders and broadcasts change events.
 *
 * Uses a debounce mechanism: when multiple changes happen within
 * the debounce window, only the latest change is broadcast.
 */
export class FolderWatcher {
  /** Currently active watchers: folderPath (POSIX) -> FSWatcher */
  private watchers = new Map<string, FSWatcher>();

  /** Debounce timers for each folder */
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Latest pending change per folder (for debounce aggregation) */
  private pendingChanges = new Map<string, PendingChange>();

  private debounceMs: number;

  constructor(debounceMs = DEFAULT_DEBOUNCE_MS) {
    this.debounceMs = debounceMs;
  }

  /**
   * Start watching a folder for file changes.
   * @param folderPath - Absolute path in platform-specific format
   */
  startWatching(folderPath: string): void {
    const posixPath = Path.posix(folderPath);

    if (this.watchers.has(posixPath)) {
      logger.debug({ folderPath: posixPath }, '[FolderWatcher] Already watching folder');
      return;
    }

    try {
      // fs.watch on directories:
      // - macOS: 'rename' for create/delete, 'change' for modify
      // - Linux: 'rename' for create/delete/rename, 'change' for modify
      // - Windows: 'rename' for create/delete/rename, 'change' for modify
      const watcher = watch(folderPath, { recursive: false }, (eventType, filename) => {
        if (!filename) return;
        if (shouldIgnore(filename)) return;

        const changeType = this.mapEventType(eventType);
        const now = Date.now();

        this.pendingChanges.set(posixPath, {
          folderPath: posixPath,
          changeType,
          filePath: filename,
          timestamp: now,
        });

        // Reset debounce timer
        const existing = this.debounceTimers.get(posixPath);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          this.flushChange(posixPath);
        }, this.debounceMs);

        this.debounceTimers.set(posixPath, timer);
      });

      this.watchers.set(posixPath, watcher);
      logger.info({ folderPath: posixPath }, '[FolderWatcher] Started watching folder');
    } catch (error) {
      logger.error(
        { folderPath: posixPath, error: error instanceof Error ? error.message : String(error) },
        '[FolderWatcher] Failed to start watching folder',
      );
    }
  }

  /**
   * Stop watching a folder.
   * @param folderPath - Absolute path in platform-specific format
   */
  stopWatching(folderPath: string): void {
    const posixPath = Path.posix(folderPath);
    const watcher = this.watchers.get(posixPath);

    if (watcher) {
      watcher.close();
      this.watchers.delete(posixPath);
      logger.info({ folderPath: posixPath }, '[FolderWatcher] Stopped watching folder');
    }

    // Clean up debounce timer and pending changes
    const timer = this.debounceTimers.get(posixPath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(posixPath);
    }
    this.pendingChanges.delete(posixPath);
  }

  /**
   * Stop watching all folders and clean up resources.
   */
  stopAllWatching(): void {
    for (const [posixPath, watcher] of this.watchers) {
      watcher.close();
      logger.debug({ folderPath: posixPath }, '[FolderWatcher] Stopped watching folder');
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();

    logger.info('[FolderWatcher] Stopped all watchers');
  }

  /**
   * Get the list of currently watched folder paths (POSIX format).
   */
  getWatchedFolders(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Check if a folder is currently being watched.
   */
  isWatching(folderPath: string): boolean {
    return this.watchers.has(Path.posix(folderPath));
  }

  /**
   * Flush the pending change for a folder and broadcast it.
   */
  private flushChange(posixPath: string): void {
    const pending = this.pendingChanges.get(posixPath);
    if (!pending) return;

    this.debounceTimers.delete(posixPath);
    this.pendingChanges.delete(posixPath);

    logger.info(
      {
        folderPath: pending.folderPath,
        changeType: pending.changeType,
        filePath: pending.filePath,
      },
      '[FolderWatcher] Broadcasting folder content change',
    );

    broadcast({
      event: FOLDER_CONTENT_CHANGED_EVENT,
      data: {
        folderPath: pending.folderPath,
        changeType: pending.changeType,
        filePath: pending.filePath,
      },
    });
  }

  /**
   * Map fs.watch event type to our change type.
   * - 'rename' -> 'created' or 'deleted' (we don't distinguish at fs.watch level)
   * - 'change' -> 'modified'
   */
  private mapEventType(eventType: 'rename' | 'change'): 'created' | 'modified' | 'deleted' {
    // fs.watch cannot reliably distinguish between create and delete on all platforms.
    // We use 'created' as default for 'rename' since both create and delete are
    // interesting to the UI. The UI can re-read the directory listing to determine
    // what actually changed.
    if (eventType === 'change') return 'modified';
    return 'created';
  }
}

/** Singleton instance */
let instance: FolderWatcher | null = null;

/**
 * Get or create the FolderWatcher singleton.
 */
export function getFolderWatcher(debounceMs?: number): FolderWatcher {
  if (!instance) {
    instance = new FolderWatcher(debounceMs);
  }
  return instance;
}

/**
 * Initialize folder watching from a list of folder paths.
 * Called during server startup.
 */
export function initializeFolderWatcher(folderPaths: string[], debounceMs?: number): FolderWatcher {
  const watcher = getFolderWatcher(debounceMs);
  for (const fp of folderPaths) {
    watcher.startWatching(fp);
  }
  return watcher;
}
