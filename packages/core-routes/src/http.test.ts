import { describe, expect, it } from "vitest";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import {
  allowsExplicitHttpCaching,
  attachCoreRoutesCacheControlGuard,
} from "./http.ts";

describe("allowsExplicitHttpCaching", () => {
  it("treats public/max-age style directives as opt-in caching", () => {
    expect(allowsExplicitHttpCaching("public, max-age=3600")).toBe(true);
    expect(allowsExplicitHttpCaching("private, max-age=60")).toBe(true);
    expect(allowsExplicitHttpCaching("no-store")).toBe(false);
    expect(allowsExplicitHttpCaching(undefined)).toBe(false);
  });
});

describe("attachCoreRoutesCacheControlGuard", () => {
  function createMockResponse() {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    const res = new ServerResponse(req);
    let capturedHeaders: Record<string, string> = {};
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = ((code: number, ...args: unknown[]) => {
      const headersArg =
        typeof args[0] === "string"
          ? (args[1] as Record<string, string> | undefined)
          : (args[0] as Record<string, string> | undefined);
      capturedHeaders = { ...(headersArg ?? {}) };
      for (const [key, value] of Object.entries(capturedHeaders)) {
        res.setHeader(key, value);
      }
      return originalWriteHead(code);
    }) as typeof res.writeHead;
    const originalEnd = res.end.bind(res);
    res.end = ((chunk?: unknown) => {
      const cc = res.getHeader("Cache-Control");
      if (cc !== undefined) {
        capturedHeaders["Cache-Control"] = Array.isArray(cc) ? cc.join(", ") : String(cc);
      }
      return originalEnd(chunk as never);
    }) as typeof res.end;
    return { res, getHeaders: () => capturedHeaders, socket };
  }

  it("adds Cache-Control: no-store when a handler omits caching headers", () => {
    const { res, getHeaders, socket } = createMockResponse();
    attachCoreRoutesCacheControlGuard(res);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    expect(getHeaders()["Cache-Control"]).toBe("no-store");
    socket.destroy();
  });

  it("preserves explicit public caching on writeHead", () => {
    const { res, getHeaders, socket } = createMockResponse();
    attachCoreRoutesCacheControlGuard(res);
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000",
    });
    res.end("binary");
    expect(getHeaders()["Cache-Control"]).toBe("public, max-age=31536000");
    socket.destroy();
  });
});
