import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadImageApi } from "./downloadImage";

describe("downloadImageApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("includes httpProxy in the request body when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: "https://image.tmdb.org/x.jpg", path: "/p/x.jpg" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadImageApi("https://image.tmdb.org/x.jpg", "/p/x.jpg", "http://proxy:8080");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.url).toBe("https://image.tmdb.org/x.jpg");
    expect(body.httpProxy).toBe("http://proxy:8080");
    expect(typeof body.path).toBe("string");
  });

  it("omits httpProxy when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: "https://image.tmdb.org/x.jpg", path: "/p/x.jpg" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadImageApi("https://image.tmdb.org/x.jpg", "/p/x.jpg");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("httpProxy");
  });

  it("trims whitespace around httpProxy and omits blank values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: "https://image.tmdb.org/x.jpg", path: "/p/x.jpg" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadImageApi("https://image.tmdb.org/x.jpg", "/p/x.jpg", "  http://proxy:8080  ");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.httpProxy).toBe("http://proxy:8080");

    fetchMock.mockClear();
    await downloadImageApi("https://image.tmdb.org/x.jpg", "/p/x.jpg", "   ");
    const [, init2] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init2.body))).not.toHaveProperty("httpProxy");
  });
});
