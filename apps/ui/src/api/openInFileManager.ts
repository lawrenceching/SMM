import { Path } from "@core/path";
import type { OpenInFileManagerRequestBody, OpenInFileManagerResponseBody } from "@core/types";

function getElectronApi():
  | { executeChannel: (request: { name: string; data: string }) => Promise<OpenInFileManagerResponseBody> }
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { api?: { executeChannel: typeof Function } }).api as
    | { executeChannel: (request: { name: string; data: string }) => Promise<OpenInFileManagerResponseBody> }
    | undefined;
}

/**
 * Open a folder in the system file manager
 * @param pathInPosix - Absolute path in POSIX format
 */
export async function openInFileManagerApi(pathInPosix: string): Promise<OpenInFileManagerResponseBody> {
  const api = getElectronApi();
  if (api?.executeChannel) {
    const req = {
      name: 'open-in-file-manager',
      data: Path.toPlatformPath(pathInPosix),
    }
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
