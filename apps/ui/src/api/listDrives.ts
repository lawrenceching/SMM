import { rpc, unwrapJson } from '@/lib/rpc';

/**
 * Wide catch-all shape: 200 `{ data, error?: undefined }`, 500 `{ data: [], error }`.
 */
export type ListDrivesResponseBody = {
  data: string[];
  error?: string;
};

/**
 * List available drives on Windows
 * @returns Array of drive paths (e.g., ["C:\\", "D:\\", "E:\\"])
 */
export async function listDrivesApi(): Promise<ListDrivesResponseBody> {
  const resp = await rpc.api.listDrives.$get();
  return unwrapJson<ListDrivesResponseBody>(resp);
}
