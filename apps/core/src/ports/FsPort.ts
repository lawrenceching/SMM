/** Runtime-agnostic file system. Paths are POSIX. Adapters convert at the boundary. */
export interface FsPort {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Recursively list all files under `dir` (not directories). */
  listFiles(dir: string): Promise<string[]>;
  /** Delete a file; missing files count as success (idempotent). */
  deleteFile(path: string): Promise<void>;
}
