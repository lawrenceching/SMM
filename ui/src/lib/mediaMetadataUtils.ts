import { listFiles } from "@/api/listFiles";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";

export async function createInitialMediaMetadata(folderPathInPlatformFormat: string, options?: { traceId?: string, abortSignal?: AbortSignal }): Promise<UIMediaMetadata> {
  
  const mm: UIMediaMetadata = {
    mediaFolderPath: Path.posix(folderPathInPlatformFormat),
    status: 'idle',
  }

  const files = await listFiles({ path: folderPathInPlatformFormat, recursively: true, onlyFiles: true }, options?.abortSignal)
  if(files.error) {
    throw new Error(`Failed to list files: ${files.error}`);
  }
  if(files.data === undefined) {
    throw new Error(`Failed to list files: response.data is undefined`);
  }
  
  mm.files = files.data.items.map(item => Path.posix(item.path));

  return mm;
}