import { Path } from "@smm/utils/path"
import { pathToFileURL } from "@smm/utils/url"

/**
 * Convert a local filesystem path to a `file://` URL for {@link Image} /
 * `useImage` (authenticated fetch via `/api/image`). Do not use raw
 * `/api/image?...` in `<img src>` — browsers cannot attach Bearer tokens.
 */
export function toLocalFileImageUrl(filePath: string): string {
  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://") ||
    filePath.startsWith("file://")
  ) {
    return filePath
  }
  return pathToFileURL(Path.toPlatformPath(filePath))
}
