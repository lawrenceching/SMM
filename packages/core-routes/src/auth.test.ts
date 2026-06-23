import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  enforceCoreRoutesAuth,
  isAuthTokenValid,
  isRequestAuthorized,
  parseBearerToken,
  rejectUnauthorized,
} from "../src/auth.ts";

describe("parseBearerToken", () => {
  it("parses Bearer token case-insensitively", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
    expect(parseBearerToken("bearer abc123")).toBe("abc123");
    expect(parseBearerToken("Bearer   spaced-token  ")).toBe("spaced-token");
  });

  it("returns null for missing or invalid header", () => {
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
  });
});

describe("isAuthTokenValid", () => {
  const expected = "secret-token";

  it("accepts matching Bearer token", () => {
    expect(isAuthTokenValid("Bearer secret-token", expected)).toBe(true);
  });

  it("rejects wrong or missing token", () => {
    expect(isAuthTokenValid("Bearer wrong", expected)).toBe(false);
    expect(isAuthTokenValid(undefined, expected)).toBe(false);
  });
});

describe("isRequestAuthorized", () => {
  it("allows all requests when auth is disabled", () => {
    expect(isRequestAuthorized(undefined, { enabled: false, token: "x" })).toBe(true);
    expect(isRequestAuthorized(undefined, undefined)).toBe(true);
  });

  it("requires valid Bearer token when auth is enabled", () => {
    const auth = { enabled: true, token: "abc" };
    expect(isRequestAuthorized("Bearer abc", auth)).toBe(true);
    expect(isRequestAuthorized("Bearer nope", auth)).toBe(false);
  });
});

describe("enforceCoreRoutesAuth", () => {
  it("returns false when auth is disabled", async () => {
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    const res = new ServerResponse(req);
    const end = vi.spyOn(res, "end").mockImplementation(() => res);

    const rejected = enforceCoreRoutesAuth(req, res, { allowlist: [] });
    expect(rejected).toBe(false);
    expect(end).not.toHaveBeenCalled();
    socket.destroy();
  });

  it("writes 401 when auth is enabled and token is invalid", async () => {
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.headers = {};
    const res = new ServerResponse(req);

    let status = 0;
    let body = "";
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    const rejected = enforceCoreRoutesAuth(req, res, {
      allowlist: [],
      auth: { enabled: true, token: "expected" },
    });

    expect(rejected).toBe(true);
    expect(status).toBe(401);
    expect(JSON.parse(body)).toEqual({
      error: "Unauthorized: invalid or missing token",
    });
    socket.destroy();
  });

  it("skips OPTIONS preflight", async () => {
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "OPTIONS";
    const res = new ServerResponse(req);
    const end = vi.spyOn(res, "end").mockImplementation(() => res);

    const rejected = enforceCoreRoutesAuth(req, res, {
      allowlist: [],
      auth: { enabled: true, token: "expected" },
    });

    expect(rejected).toBe(false);
    expect(end).not.toHaveBeenCalled();
    socket.destroy();
  });
});

describe("rejectUnauthorized", () => {
  it("sends 401 JSON body", async () => {
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    const res = new ServerResponse(req);

    let status = 0;
    let body = "";
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    rejectUnauthorized(res);
    expect(status).toBe(401);
    expect(JSON.parse(body)).toEqual({
      error: "Unauthorized: invalid or missing token",
    });
    socket.destroy();
  });
});
