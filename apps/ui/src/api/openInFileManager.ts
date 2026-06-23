import { Path } from "@core/path";
import type { OpenInFileManagerRequestBody, OpenInFileManagerResponseBody } from "@core/types";
import { apiFetch } from '@/lib/apiFetch';

const OPEN_IN_FILE_MANAGER_CHANNEL = "open-in-file-manager";

function getElectronApi():
  | { executeChannel: (request: { name: string; data: string }) => Promise<{ name: string; data: unknown }> }
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { api?: { executeChannel: typeof Function } }).api as
    | { executeChannel: (request: { name: string; data: string }) => Promise<{ name: string; data: unknown }> }
    | undefined;
}

function formatOpenInFileManagerError(error: unknown): string | undefined {
  if (error == null) {
    return undefined;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function mapExecuteChannelResponse(
  response: { name: string; data: unknown },
  path: string,
): OpenInFileManagerResponseBody {
  const data = response.data as { success?: boolean; error?: unknown } | undefined;
  if (data?.success) {
    return { data: { path } };
  }

  const error = formatOpenInFileManagerError(data?.error);
  return error ? { data: { path }, error } : { data: { path } };
}

/**
 * Open a folder in the system file manager
 * @param pathInPosix - Absolute path in POSIX format
 */
export async function openInFileManagerApi(pathInPosix: string): Promise<OpenInFileManagerResponseBody> {
  const api = getElectronApi();
  const platformPath = Path.toPlatformPath(pathInPosix);

  if (api?.executeChannel) {
    const response = await api.executeChannel({
      name: OPEN_IN_FILE_MANAGER_CHANNEL,
      data: platformPath,
    });
    return mapExecuteChannelResponse(response, platformPath);
  }

  const req: OpenInFileManagerRequestBody = {
    path: platformPath,
  };
  
  const resp = await apiFetch('/api/openInFileManager', {
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
