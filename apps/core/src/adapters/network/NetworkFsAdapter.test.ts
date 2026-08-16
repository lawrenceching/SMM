import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../../ports/NetworkPort";
import { NetworkFsAdapter } from "./NetworkFsAdapter";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
  };
}

function mockNetwork(): { network: NetworkPort; calls: Array<{ url: string; body: unknown }> } {
  const calls: Array<{ url: string; body: unknown }> = [];
  const network: NetworkPort = {
    fetch: async (url, init) => {
      const body = JSON.parse(init?.body ?? "{}");
      calls.push({ url, body });
      if (url.endsWith("/api/readFile")) {
        if (String(body.path).includes("missing")) {
          return jsonResponse({ error: `File Not Found: ${body.path}` });
        }
        return jsonResponse({ data: "file-content" });
      }
      if (url.endsWith("/api/writeFile")) {
        return jsonResponse({});
      }
      if (url.endsWith("/api/listFiles")) {
        return jsonResponse({
          data: { path: body.path, items: [{ path: "/m/a.mkv" }, { path: "/m/b.srt" }], size: 0 },
        });
      }
      throw new Error("unexpected url: " + url);
    },
  };
  return { network, calls };
}

describe("NetworkFsAdapter", () => {
  it("reads a file via POST /api/readFile", async () => {
    const { network, calls } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    const content = await adapter.readTextFile("/m/file.txt");

    expect(content).toBe("file-content");
    expect(calls[0]).toEqual({ url: "http://127.0.0.1:30000/api/readFile", body: { path: "/m/file.txt" } });
  });

  it("writes a file via POST /api/writeFile", async () => {
    const { network, calls } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    await adapter.writeTextFile("/m/file.txt", "hello");

    expect(calls[0]).toEqual({
      url: "http://127.0.0.1:30000/api/writeFile",
      body: { path: "/m/file.txt", mode: "overwrite", data: "hello" },
    });
  });

  it("lists files recursively via POST /api/listFiles", async () => {
    const { network, calls } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    const files = await adapter.listFiles("/m");

    expect(files).toEqual(["/m/a.mkv", "/m/b.srt"]);
    expect(calls[0]).toEqual({
      url: "http://127.0.0.1:30000/api/listFiles",
      body: { path: "/m", recursively: true, onlyFiles: true },
    });
  });

  it("exists() is true when readFile succeeds and false on File Not Found", async () => {
    const { network } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    expect(await adapter.exists("/m/file.txt")).toBe(true);
    expect(await adapter.exists("/m/missing.txt")).toBe(false);
  });
});
