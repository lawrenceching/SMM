/** Runtime-agnostic file system. Paths are POSIX. Adapters convert at the boundary. */
export interface FsPort {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  /** Write raw bytes; parent directories are created if needed. Paths are POSIX. */
  writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /**
   * True iff the path exists and is a regular file (not a directory).
   * Optional for transitional mocks; prefer implementing for rename preflight.
   */
  isFile?(path: string): Promise<boolean>;
  /** Recursively list all files under `dir` (not directories). */
  listFiles(dir: string): Promise<string[]>;
  /** List immediate child directories under `dir` (non-recursive; hidden entries excluded). */
  listSubdirectories(dir: string): Promise<string[]>;
  /** Delete a file; missing files count as success (idempotent). */
  deleteFile(path: string): Promise<void>;
  /** Rename/move a file or directory. Paths are POSIX. Missing source should reject. */
  rename(from: string, to: string): Promise<void>;
  /** Create a directory (and parents). Idempotent if it already exists. Paths are POSIX. */
  mkdir(path: string): Promise<void>;
}
