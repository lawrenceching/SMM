import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";

export interface NetworkFsAdapterOptions {
  network: NetworkPort;
  /** Base URL of the internal HTTP API, e.g. "http://127.0.0.1:30000". */
  baseUrl: string;
}

/**
 * Browser-runtime FsPort: maps file operations to the internal HTTP fs
 * endpoints exposed by Layer 3 (core-routes). Paths are POSIX; the endpoints
 * accept both POSIX and platform formats.
 */
export class NetworkFsAdapter implements FsPort {
  constructor(private readonly options: NetworkFsAdapterOptions) {}

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const resp = await this.options.network.fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} from ${path}`);
    }
    return resp.json<T>();
  }

  async readTextFile(path: string): Promise<string> {
    const json = await this.post<{ data?: string; error?: string }>("/api/readFile", { path });
    if (json.error !== undefined) throw new Error(json.error);
    if (json.data === undefined) throw new Error(`readFile returned no data for ${path}`);
    return json.data;
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const json = await this.post<{ error?: string }>("/api/writeFile", {
      path,
      mode: "overwrite",
      data: content,
    });
    if (json.error !== undefined) throw new Error(json.error);
  }

  async writeBinaryFile(_path: string, _data: Uint8Array): Promise<void> {
    throw new Error("Not Implemented: NetworkFsAdapter.writeBinaryFile");
  }

  async exists(path: string): Promise<boolean> {
    const json = await this.post<{ error?: string }>("/api/readFile", { path });
    return !(json.error !== undefined && json.error.startsWith("File Not Found"));
  }

  /** Best-effort: readFile success implies a readable file (not a directory listing). */
  async isFile(path: string): Promise<boolean> {
    return this.exists(path);
  }

  async listFiles(dir: string): Promise<string[]> {
    const json = await this.post<{
      error?: string;
      data?: { items: Array<{ path: string }> };
    }>("/api/listFiles", { path: dir, recursively: true, onlyFiles: true });
    if (json.error !== undefined) throw new Error(json.error);
    return (json.data?.items ?? []).map((i) => i.path);
  }

  async deleteFile(path: string): Promise<void> {
    const json = await this.post<{ error?: string }>("/api/deleteFile", { path });
    if (json.error !== undefined) throw new Error(json.error);
  }

  async rename(_from: string, _to: string): Promise<void> {
    throw new Error("Not Implemented: NetworkFsAdapter.rename");
  }

  async mkdir(_path: string): Promise<void> {
    throw new Error("Not Implemented: NetworkFsAdapter.mkdir");
  }
}
