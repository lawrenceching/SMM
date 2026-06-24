import { brotliCompress } from "node:zlib";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { createNodeHttpFetch } from "./nodeHttpFetch.ts";

const brotliCompressAsync = promisify(brotliCompress);

describe("createNodeHttpFetch", () => {
  it("decompresses brotli-encoded JSON responses", async () => {
    const payload = JSON.stringify({ status: "success", data: [1, 2, 3] });
    const fetchImpl = createNodeHttpFetch();
    const brotliBody = await brotliCompressAsync(Buffer.from(payload, "utf8"));

    const request = new Request("https://example.test/resource", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const originalHttpsRequest = (await import("node:https")).default.request;
    const https = await import("node:https");
    const requestSpy = vi
      .spyOn(https.default, "request")
      .mockImplementation((_options, callback) => {
        const res = {
          statusCode: 200,
          statusMessage: "OK",
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "content-encoding": "br",
          },
          on(event: string, handler: (...args: unknown[]) => void) {
            if (event === "data") {
              handler(brotliBody);
            }
            if (event === "end") {
              handler();
            }
          },
        };
        queueMicrotask(() => callback?.(res as never));
        return {
          on() {},
          write() {},
          end() {},
        } as never;
      });

    try {
      const response = await fetchImpl(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-encoding")).toBeNull();
      await expect(response.json()).resolves.toEqual({
        status: "success",
        data: [1, 2, 3],
      });
      expect(requestSpy).toHaveBeenCalledOnce();
    } finally {
      requestSpy.mockRestore();
      void originalHttpsRequest;
    }
  });

  it("maps upstream 304 to a constructible 200 Response", async () => {
    const fetchImpl = createNodeHttpFetch();
    const request = new Request("https://example.test/resource", { method: "GET" });

    const https = await import("node:https");
    const requestSpy = vi
      .spyOn(https.default, "request")
      .mockImplementation((_options, callback) => {
        const res = {
          statusCode: 304,
          statusMessage: "Not Modified",
          headers: { etag: '"abc"' },
          on(event: string, handler: (...args: unknown[]) => void) {
            if (event === "end") {
              handler();
            }
          },
        };
        queueMicrotask(() => callback?.(res as never));
        return {
          on() {},
          write() {},
          end() {},
        } as never;
      });

    try {
      const response = await fetchImpl(request);
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("");
    } finally {
      requestSpy.mockRestore();
    }
  });
});
