import { describe, expect, it } from "vitest";
import {
  HostPerformanceStore,
  mergeHostUrls,
  selectCandidateHosts,
} from "./hostPerformance";

describe("mergeHostUrls", () => {
  it("keeps static hosts first and appends unique remote hosts", () => {
    expect(
      mergeHostUrls(
        ["https://static.example/api/tmdb/", "https://static-2.example"],
        ["https://remote.example", "https://static.example/api/tmdb"],
      ),
    ).toEqual([
      "https://static.example/api/tmdb",
      "https://static-2.example",
      "https://remote.example",
    ]);
  });
});

describe("selectCandidateHosts", () => {
  const defaultUpstream = "https://mediadb.vercel.app/api/tmdb";

  it("uses only the custom host and disables failover", () => {
    const result = selectCandidateHosts({
      customHost: "https://api.themoviedb.org/3",
      defaultUpstream,
      performanceList: [{ host: "https://fast.example", score: 1 }],
      fallbackHosts: ["https://a.example", "https://b.example"],
    });

    expect(result).toEqual({
      hosts: ["https://api.themoviedb.org/3"],
      allowFailover: false,
    });
  });

  it("uses fallback host order when the performance list is empty", () => {
    const result = selectCandidateHosts({
      defaultUpstream,
      performanceList: [],
      fallbackHosts: ["https://static.example", "https://remote.example"],
    });

    expect(result).toEqual({
      hosts: ["https://static.example", "https://remote.example"],
      allowFailover: true,
    });
  });

  it("uses performance-list order when speed test results exist", () => {
    const result = selectCandidateHosts({
      defaultUpstream,
      performanceList: [
        { host: "https://slow.example", score: 2.5 },
        { host: "https://fast.example", score: 0.4 },
      ],
      fallbackHosts: ["https://static.example"],
    });

    expect(result).toEqual({
      hosts: ["https://slow.example", "https://fast.example"],
      allowFailover: true,
    });
  });
});

describe("HostPerformanceStore", () => {
  it("promotes a successful host to the top with score 0", () => {
    const store = new HostPerformanceStore();
    store.set("tmdb", [
      { host: "https://a.example", score: 1.2 },
      { host: "https://b.example", score: 0.8 },
    ]);

    store.promoteToTop("tmdb", "https://b.example/");

    expect(store.get("tmdb")).toEqual([
      { host: "https://b.example", score: 0 },
      { host: "https://a.example", score: 1.2 },
    ]);
  });

  it("matches a successful host by hostname when the URL includes a path", () => {
    const store = new HostPerformanceStore();
    store.set("tmdb-asset", [{ host: "https://cdn.example/assets", score: 1 }]);
    store.promoteToTop("tmdb-asset", "https://cdn.example/t/p/original/x.jpg");
    expect(store.get("tmdb-asset")[0]).toEqual({ host: "https://cdn.example/assets", score: 0 });
  });

  it("does not promote when the performance list is empty", () => {
    const store = new HostPerformanceStore();
    store.promoteToTop("tmdb", "https://a.example");
    expect(store.get("tmdb")).toEqual([]);
  });
});
