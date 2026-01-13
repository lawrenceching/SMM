/**
 * For a folder name like:
 * XXX (tmdbid=123456)
 * XXX {tmdbid=123456}
 *
 * This method will extract and return the TMDB ID
 */
export function getTmdbIdFromFolderName(folderName: string): string | null {
  // Match patterns like (tmdbid=123456) or {tmdbid=123456}
  const match = folderName.match(/[\(\{]\s*tmdbid\s*=\s*(\d+)\s*[\}\)]/i);
  return match ? match[1] : null;
}