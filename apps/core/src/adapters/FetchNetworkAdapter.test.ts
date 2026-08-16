import { describe, expect, it } from "vitest";
import type { FetchInit, HttpResponse } from "../ports/NetworkPort";
import { FetchNetworkAdapter } from "./FetchNetworkAdapter";

function fakeResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve("body-text"),
    json: <T>() => Promise.resolve({} as T),
    ...overrides,
  };
}

describe("FetchNetworkAdapter", () => {
  it("delegates to an injected fetch and passes init through", async () => {
    const calls: Array<{ input: string; init?: FetchInit }> = [];
    const injected = async (input: string, init?: FetchInit): Promise<HttpResponse> => {
      calls.push({ input, init });
      return fakeResponse();
    };

    const adapter = new FetchNetworkAdapter(injected);
    const resp = await adapter.fetch("https://example.com/api", { method: "POST", headers: { "X-A": "1" }, body: "{}" });

    expect(resp.ok).toBe(true);
    expect(resp.status).toBe(200);
    expect(await resp.json<{ ok: boolean }>()).toEqual({});
    expect(calls).toEqual([
      { input: "https://example.com/api", init: { method: "POST", headers: { "X-A": "1" }, body: "{}" } },
    ]);
  });

  it("uses globalThis.fetch when no fetch is injected", async () => {
    const original = globalThis.fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = async () => fakeResponse({ status: 201 });
    try {
      const adapter = new FetchNetworkAdapter();
      const resp = await adapter.fetch("https://example.com");
      expect(resp.status).toBe(201);
    } finally {
      (globalThis as unknown as { fetch: unknown }).fetch = original;
    }
  });
});
