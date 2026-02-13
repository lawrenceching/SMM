export interface ListDrivesResponseBody {
  data: string[];
  error?: string;
}

/**
 * List available drives on Windows
 * @returns Array of drive paths (e.g., ["C:\\", "D:\\", "E:\\"])
 */
export async function listDrivesApi(): Promise<ListDrivesResponseBody> {
  const resp = await fetch('/api/listDrives', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to list drives: ${resp.statusText}`);
  }

  const data: ListDrivesResponseBody = await resp.json();
  return data;
}
