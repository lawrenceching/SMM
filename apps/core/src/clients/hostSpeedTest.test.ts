import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { speedTestHosts } from "./hostSpeedTest";

function jsonOk(): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve("{}"),
    json: <T>() => Promise.resolve({} as T),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

describe("speedTestHosts", () => {
  it("scores reachable hosts by duration in seconds and sorts lower first", async () => {
    let nowMs = 0;
    const network: NetworkPort = {
      fetch: async (url) => {
        nowMs += url.includes("slow") ? 2500 : 400;
        return jsonOk();
      },
    };

    const results = await speedTestHosts(
      network,
      ["https://slow.example/api/tmdb", "https://fast.example/api/tmdb"],
      { now: () => nowMs },
    );

    expect(results.map((entry) => entry.host)).toEqual([
      "https://fast.example/api/tmdb",
      "https://slow.example/api/tmdb",
    ]);
    expect(results[0]!.score).toBe(0.4);
    expect(results[1]!.score).toBe(2.5);
  });

  it("omits hosts that fail at TCP layer so an all-fail run leaves the list empty", async () => {
    const network: NetworkPort = {
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    };

    const results = await speedTestHosts(network, ["https://dead.example", "https://also-dead.example"]);

    expect(results).toEqual([]);
  });

  it("keeps HTTP 4xx/5xx hosts because they are reachable", async () => {
    const network: NetworkPort = {
      fetch: async () => ({
        ok: false,
        status: 500,
        statusText: "ERR",
        headers: {},
        text: () => Promise.resolve(""),
        json: async () => {
          throw new Error("no json");
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    };

    const results = await speedTestHosts(network, ["https://http-error.example"], { now: () => 0 });

    expect(results).toEqual([{ host: "https://http-error.example", score: 0 }]);
  });
});
