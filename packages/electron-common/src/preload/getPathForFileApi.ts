export interface GetPathForFilePreloadApi {
  getPathForFile: (file: File) => string | null
}

export interface WebUtilsGetPathForFile {
  getPathForFile: (file: File) => string
}

export function createGetPathForFilePreloadApi(
  webUtils: WebUtilsGetPathForFile,
): GetPathForFilePreloadApi {
  return {
    getPathForFile: (file: File): string | null => {
      try {
        const path = webUtils.getPathForFile(file)
        return path || null
      } catch (error) {
        console.error("[Preload] Failed to get path for file:", error)
        return null
      }
    },
  }
}
