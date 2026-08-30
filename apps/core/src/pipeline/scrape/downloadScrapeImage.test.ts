import type { MediaMetadata, UserConfig } from "@smm/types";
import { describe, expect, it, vi } from "vitest";
import type { DiscoverConfig, DiscoverPort } from "../../ports/DiscoverPort";
import type { FetchInit, HttpResponse, NetworkPort } from "../../ports/NetworkPort";
import type { FsPort } from "../../ports/FsPort";
import { DEFAULT_USER_CONFIG } from "../userConfigHelper";
import { downloadScrapeImage } from "./downloadScrapeImage";

function createInMemoryFs(): FsPort & {
  binaryFiles: Map<string, Uint8Array>;
  mkdirCalls: string[];
} {
  const binaryFiles = new Map<string, Uint8Array>();
  const mkdirCalls: string[] = [];
  return {
    binaryFiles,
    mkdirCalls,
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    writeBinaryFile: vi.fn(async (path, data) => {
      binaryFiles.set(path, data);
    }),
    exists: vi.fn(async (path) => binaryFiles.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(async (path) => {
      mkdirCalls.push(path);
    }),
    listSubdirectories: vi.fn(async () => []),
  };
}

function fakeImageResponse(bytes: Uint8Array, ok = true): HttpResponse {
  return {
    ok,
    status: ok ? 200 : 503,
    statusText: ok ? "OK" : "Service Unavailable",
    headers: { "content-type": "image/jpeg" },
    text: () => Promise.resolve(""),
    json: <T>() => Promise.resolve({} as T),
    arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer),
  };
}

const movieMetadata: MediaMetadata = {
  type: "movie-folder",
  mediaFolderPath: "/media/Fight Club",
  movie: { id: "550", database: "TMDB", name: "Fight Club" },
} as MediaMetadata;

function userConfig(overrides: Partial<UserConfig> = {}): UserConfig {
  return { ...DEFAULT_USER_CONFIG, ...overrides };
}

describe("downloadScrapeImage", () => {
  it("fetches image bytes and writes them via writeBinaryFile", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const network: NetworkPort = {
      fetch: vi.fn(async () => fakeImageResponse(fakeBytes)),
    };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/t/p/original/poster.jpg",
      "/media/Fight Club/poster.jpg",
      userConfig(),
      fs,
      network,
    );

    expect(fs.binaryFiles.get("/media/Fight Club/poster.jpg")).toEqual(fakeBytes);
    expect(fs.writeBinaryFile).toHaveBeenCalledWith("/media/Fight Club/poster.jpg", fakeBytes);
  });

  it("creates the parent directory before writing", async () => {
    const fs = createInMemoryFs();
    const network: NetworkPort = {
      fetch: vi.fn(async () => fakeImageResponse(new Uint8Array([1]))),
    };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/x.jpg",
      "/media/Show/sub/poster.jpg",
      userConfig(),
      fs,
      network,
    );

    expect(fs.mkdirCalls).toContain("/media/Show/sub");
  });

  it("sends browser-like headers on fetch", async () => {
    const fs = createInMemoryFs();
    const fetch = vi.fn(async () => fakeImageResponse(new Uint8Array([1])));
    const network: NetworkPort = { fetch };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/x.jpg",
      "/media/poster.jpg",
      userConfig(),
      fs,
      network,
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://image.tmdb.org/x.jpg",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          accept: expect.stringContaining("image/"),
          "user-agent": expect.stringContaining("Mozilla"),
        }),
      }),
    );
  });

  it("normalizes protocol-relative image URLs", async () => {
    const fs = createInMemoryFs();
    const fetch = vi.fn(async () => fakeImageResponse(new Uint8Array([1])));
    const network: NetworkPort = { fetch };

    await downloadScrapeImage(
      movieMetadata,
      "//image.tmdb.org/t/p/original/poster.jpg",
      "/media/poster.jpg",
      userConfig(),
      fs,
      network,
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://image.tmdb.org/t/p/original/poster.jpg",
      expect.any(Object),
    );
  });

  it("throws when the upstream response is not ok", async () => {
    const fs = createInMemoryFs();
    const network: NetworkPort = {
      fetch: vi.fn(async () => fakeImageResponse(new Uint8Array(), false)),
    };

    await expect(
      downloadScrapeImage(
        movieMetadata,
        "https://image.tmdb.org/x.jpg",
        "/media/poster.jpg",
        userConfig(),
        fs,
        network,
      ),
    ).rejects.toThrow("HTTP error! status: 503");
  });

  it("passes resolved httpProxy to deps.fetch when configured", async () => {
    const fs = createInMemoryFs();
    const customFetch = vi.fn(async (_url: string, _init?: FetchInit, httpProxy?: string) => {
      expect(httpProxy).toBe("http://proxy:8080");
      return fakeImageResponse(new Uint8Array([1]));
    });
    const network: NetworkPort = { fetch: vi.fn() };
    const uc = userConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" },
    });

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/x.jpg",
      "/media/poster.jpg",
      uc,
      fs,
      network,
      { fetch: customFetch },
    );

    expect(customFetch).toHaveBeenCalledOnce();
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("uses network.fetch directly when no proxy is configured", async () => {
    const fs = createInMemoryFs();
    const fetch = vi.fn(async () => fakeImageResponse(new Uint8Array([1])));
    const network: NetworkPort = { fetch };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/x.jpg",
      "/media/poster.jpg",
      userConfig({ tmdb: { host: "", httpProxy: "" } }),
      fs,
      network,
    );

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("failovers to discover tmdb-asset mirror when the default CDN host fails", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const urls: string[] = [];
    const network: NetworkPort = {
      fetch: vi.fn(async (url: string) => {
        urls.push(url);
        if (url.includes("wronghost.tmdb.local")) {
          throw new Error("ECONNREFUSED");
        }
        if (url.includes("tmdb-mirror.example")) {
          return fakeImageResponse(fakeBytes);
        }
        throw new Error(`unexpected url: ${url}`);
      }),
    };

    const discoverConfig: DiscoverConfig = {
      mediaDatabases: [
        {
          type: "tmdb-asset",
          url: "https://tmdb-mirror.example",
          authorizationMethod: "none",
        },
      ],
      reverseProxies: [],
    };
    const discover: DiscoverPort = {
      getDiscoverConfig: vi.fn(async () => discoverConfig),
    };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/t/p/original/poster.jpg",
      "/media/Fight Club/poster.jpg",
      userConfig(),
      fs,
      network,
      {
        discover,
        overrideDefaultTmdbAssetServerHost: "wronghost.tmdb.local",
      },
    );

    expect(urls).toEqual([
      "https://wronghost.tmdb.local/t/p/original/poster.jpg",
      "https://tmdb-mirror.example/t/p/original/poster.jpg",
    ]);
    expect(fs.binaryFiles.get("/media/Fight Club/poster.jpg")).toEqual(fakeBytes);
  });

  it("failovers when the first candidate throws a network error", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([1, 2, 3]);
    const network: NetworkPort = {
      fetch: vi.fn(async (url: string) => {
        if (url.includes("image.tmdb.org")) {
          throw new Error("network down");
        }
        return fakeImageResponse(fakeBytes);
      }),
    };
    const discover: DiscoverPort = {
      getDiscoverConfig: async () => ({
        mediaDatabases: [
          {
            type: "tmdb-asset",
            url: "https://tmdb-mirror.example",
            authorizationMethod: "none",
          },
        ],
        reverseProxies: [],
      }),
    };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/t/p/original/poster.jpg",
      "/media/poster.jpg",
      userConfig(),
      fs,
      network,
      { discover },
    );

    expect(fs.binaryFiles.get("/media/poster.jpg")).toEqual(fakeBytes);
    expect(network.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when all candidates fail", async () => {
    const fs = createInMemoryFs();
    const network: NetworkPort = {
      fetch: vi.fn(async () => fakeImageResponse(new Uint8Array(), false)),
    };
    const discover: DiscoverPort = {
      getDiscoverConfig: async () => ({
        mediaDatabases: [
          {
            type: "tmdb-asset",
            url: "https://tmdb-mirror.example",
            authorizationMethod: "none",
          },
        ],
        reverseProxies: [],
      }),
    };

    await expect(
      downloadScrapeImage(
        movieMetadata,
        "https://image.tmdb.org/t/p/original/poster.jpg",
        "/media/poster.jpg",
        userConfig(),
        fs,
        network,
        { discover },
      ),
    ).rejects.toThrow("HTTP error! status: 503");

    expect(network.fetch).toHaveBeenCalledTimes(1);
  });

  it("downloads from the official CDN when discover is unavailable", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([9]);
    const fetch = vi.fn(async () => fakeImageResponse(fakeBytes));
    const network: NetworkPort = { fetch };
    const discover: DiscoverPort = {
      getDiscoverConfig: async () => {
        throw new Error("discover offline");
      },
    };

    await downloadScrapeImage(
      movieMetadata,
      "https://image.tmdb.org/t/p/original/poster.jpg",
      "/media/poster.jpg",
      userConfig(),
      fs,
      network,
      { discover },
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://image.tmdb.org/t/p/original/poster.jpg",
      expect.any(Object),
    );
    expect(fs.binaryFiles.get("/media/poster.jpg")).toEqual(fakeBytes);
  });
});
