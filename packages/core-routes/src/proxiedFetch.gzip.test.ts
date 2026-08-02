import { gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { describe, expect, it, vi } from "vitest";
import { nodeHttpMessageToFetchResponse } from "./httpContentEncoding.ts";
import { createProxiedFetch } from "./proxiedFetch.ts";

describe("nodeHttpMessageToFetchResponse", () => {
  it("decompresses gzip JSON and strips Content-Encoding", async () => {
    const payload = JSON.stringify({
      status: "success",
      data: { token: "token-abc" },
    });
    const wire = gzipSync(Buffer.from(payload, "utf8"));

    const response = await nodeHttpMessageToFetchResponse(
      {
        statusCode: 200,
        statusMessage: "OK",
        headers: {
          "content-type": "application/json",
          "content-encoding": "gzip",
          "content-length": String(wire.length),
        },
      },
      wire,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      status: "success",
      data: { token: "token-abc" },
    });
  });
});

describe("createProxiedFetch Node HTTP(S) agent path", () => {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

  it.skipIf(isBun)(
    "decompresses gzip TVDB-style login bodies via HttpsProxyAgent path",
    async () => {
      const payload = JSON.stringify({
        status: "success",
        data: { token: "token-from-tvdb" },
      });
      const gzipBody = gzipSync(Buffer.from(payload, "utf8"));

      const https = await import("node:https");
      const requestSpy = vi
        .spyOn(https.default, "request")
        .mockImplementation((options, callback) => {
          const opts = options as RequestOptions;
          const onResponse = callback as ((res: IncomingMessage) => void) | undefined;
          expect(opts).toMatchObject({
            hostname: "api4.thetvdb.com",
            path: "/v4/login",
            method: "POST",
          });
          expect(opts.agent).toBeDefined();
          // Accept-Encoding should be stripped so upstream prefers identity
          const headers = opts.headers as Record<string, string>;
          expect(
            Object.keys(headers).find((k) => k.toLowerCase() === "accept-encoding"),
          ).toBeUndefined();

          const res = {
            statusCode: 200,
            statusMessage: "OK",
            headers: {
              "content-type": "application/json",
              "content-encoding": "gzip",
            },
            on(event: string, handler: (...args: unknown[]) => void) {
              if (event === "data") handler(gzipBody);
              if (event === "end") handler();
            },
          } as IncomingMessage;
          queueMicrotask(() => {
            onResponse?.(res);
          });
          return {
            on() {
              return this;
            },
            write() {},
            end() {},
            destroy() {},
          } as never;
        });

      try {
        const proxied = createProxiedFetch("http://127.0.0.1:7897");
        const response = await proxied("https://api4.thetvdb.com/v4/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate, br",
          },
          body: JSON.stringify({ apikey: "test-key" }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-encoding")).toBeNull();
        await expect(response.json()).resolves.toEqual({
          status: "success",
          data: { token: "token-from-tvdb" },
        });
        expect(requestSpy).toHaveBeenCalled();
      } finally {
        requestSpy.mockRestore();
      }
    },
  );
});
