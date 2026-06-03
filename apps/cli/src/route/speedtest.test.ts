import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { handleSpeedtest } from "./speedtest";

/**
 * Helper to create a Response-like object for mocked fetch.
 */
function okResponse(delayMs = 0): Promise<Response> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(new Response("ok", { status: 200 })), delayMs),
  );
}

describe("handleSpeedtest", () => {
  let app: Hono;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock fetch globally for all tests to avoid real network calls
    mockFetch = vi.spyOn(globalThis, "fetch");
    mockFetch.mockImplementation(() => okResponse(10));

    app = new Hono();
    handleSpeedtest(app);
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe("validation", () => {
    it("rejects missing body", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("urls must be an array");
    });

    it("rejects empty urls array", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("urls must be a non-empty array");
    });

    it("rejects invalid JSON", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid JSON body");
    });

    it("rejects non-string URL items", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [123] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("each url must be a string");
    });

    it("rejects disallowed hostnames", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["https://evil.com/test"] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("evil.com");
    });

    it("rejects invalid URL format", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["not-a-valid-url"] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("invalid URL");
    });

    it("allows github.com URLs", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: ["https://github.com/lawrenceching/SMM/wiki/test"],
        }),
      });
      expect(res.status).not.toBe(400);
    });

    it("allows gitcode.com URLs", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: ["https://gitcode.com/lawrenceching/test"],
        }),
      });
      expect(res.status).not.toBe(400);
    });

    it("allows subdomains of github.com and gitcode.com", async () => {
      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: ["https://www.github.com/test", "https://api.gitcode.com/test"],
        }),
      });
      expect(res.status).not.toBe(400);
    });
  });

  describe("speed measurement", () => {
    it("returns fastest URL from results", async () => {
      // Override mock to simulate different response times
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return new Response("ok", { status: 200 });
      });

      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [
            "https://github.com/lawrenceching/SMM/wiki/slow",
            "https://gitcode.com/lawrenceching/simple-media-manager/fast",
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fastestUrl).toBe(
        "https://gitcode.com/lawrenceching/simple-media-manager/fast",
      );
      expect(body.results).toHaveLength(2);
      expect(body.results[0].url).toBe(
        "https://github.com/lawrenceching/SMM/wiki/slow",
      );
      expect(body.results[1].url).toBe(
        "https://gitcode.com/lawrenceching/simple-media-manager/fast",
      );
      expect(typeof body.results[0].timeMs).toBe("number");
      expect(typeof body.results[1].timeMs).toBe("number");
    });

    it("handles fetch errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [
            "https://github.com/lawrenceching/SMM/wiki/test",
            "https://gitcode.com/lawrenceching/simple-media-manager/test",
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // Both failed, fallback to first URL
      expect(body.fastestUrl).toBe(
        "https://github.com/lawrenceching/SMM/wiki/test",
      );
      expect(body.results).toHaveLength(2);
      expect(body.results[0].error).toBeDefined();
      expect(body.results[1].error).toBeDefined();
    });

    it("handles partial failures", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        callCount++;
        const urlStr = url.toString();
        if (urlStr.includes("github.com")) {
          throw new Error("GitHub timeout");
        }
        return new Response("ok", { status: 200 });
      });

      const res = await app.request("/api/speedtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [
            "https://github.com/lawrenceching/SMM/wiki/test1",
            "https://gitcode.com/lawrenceching/simple-media-manager/test2",
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // GitCode succeeded, it should be the fastest
      expect(body.fastestUrl).toBe(
        "https://gitcode.com/lawrenceching/simple-media-manager/test2",
      );
      expect(body.results[0].error).toBeDefined();
      expect(body.results[1].error).toBeUndefined();
    });
  });
});
