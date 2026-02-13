import { Path } from "@core/path";
import type { OpenInFileManagerRequestBody, OpenInFileManagerResponseBody } from "@core/types";


// Check if running in Electron environment
function isElectron(): boolean {
  return typeof window !== 'undefined' && (
    typeof (window as any).electron !== 'undefined' || 
    typeof (window as any).api !== 'undefined'
  );
}

/**
 * Open a folder in the system file manager
 * @param pathInPosix - Absolute path in POSIX format
 */
export async function openInFileManagerApi(pathInPosix: string): Promise<OpenInFileManagerResponseBody> {

  if(isElectron()) {
    const req = {
      name: 'open-in-file-manager',
      data: Path.toPlatformPath(pathInPosix),
    }
    const api = (window as any).api;
    return await api.executeChannel(req);
  }

  const req: OpenInFileManagerRequestBody = {
    path: Path.toPlatformPath(pathInPosix),
  };
  
  const resp = await fetch('/api/openInFileManager', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    const errorData = await resp.json() as OpenInFileManagerResponseBody;
    return errorData;
  }

  return (await resp.json()) as OpenInFileManagerResponseBody;
}
