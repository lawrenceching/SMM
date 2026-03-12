import { Path } from "@core/path";

/**
 * Normalizes a path string so that Path class parses it correctly on Windows.
 * When the client sends a POSIX-style path (e.g. "C:/Users/..."), Path's split()
 * produces root[0] = "C:" and platformAbsPath() then wrongly uses UNC logic.
 * Convert "C:/..." to "C:\..." on Windows before passing to Path.
 */
export function pathForPathClass(path: string): string {
  if (Path.isWindows() && /^[A-Za-z]:\//.test(path)) {
    return path.replace(/\//g, "\\");
  }
  return path;
}
