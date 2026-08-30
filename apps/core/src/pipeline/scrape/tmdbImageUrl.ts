/**
 * Build a TMDB image CDN URL from a relative path or pass through absolute URLs.
 * Image URLs are served by the TMDB image CDN directly.
 */
export function getTmdbImageUrl(
  path: string | null | undefined,
  size: "original" | "w500" = "w500",
): string | null {
  if (!path || typeof path !== "string") return null;

  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) return null;

  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath;
  }

  const baseUrl = "https://image.tmdb.org/t/p";
  return `${baseUrl}/${size}${trimmedPath}`;
}
