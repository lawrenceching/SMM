import { describe, expect, it } from "vitest";
import { doChat } from "./chat.ts";
import type { ChatConfig, ChatRequestBody } from "./chatTypes.ts";
import type { UserConfig } from "@smm/core/types";

/**
 * Minimal stub for the `doChat` smoke tests below. We do NOT exercise
 * the real `streamText` path here — the AI SDK + a live model is
 * covered by `apps/cli`'s chat integration tests. The goal of this
 * file is to confirm the *early-out* branches (no provider, invalid
 * JSON, aborted) are wired correctly so the new handler returns the
 * same `Response` shape that `apps/cli`'s Hono shell used to produce
 * from `ChatTask.ts`.
 */
function makeConfig(overrides: Partial<ChatConfig> = {}): ChatConfig {
  const userConfig: UserConfig = {
    folders: [],
    tmdb: {},
    renameRules: [],
    dryRun: false,
    selectedRenameRule: "plex",
  };
  return {
    appDataDir: "/tmp",
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    createAIProvider: () => {
      throw new Error("No AI provider selected");
    },
    getUserConfig: async () => userConfig,
    ...overrides,
  };
}

function makeRequest(body: ChatRequestBody | string | undefined): Request {
  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request("http://localhost/api/chat", init);
}

describe("doChat — early-out branches", () => {
  it("returns 400 when no AI provider is selected", async () => {
    const response = await doChat(makeConfig(), makeRequest({ clientId: "x" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("No AI selected");
  });

  it("returns 400 when createAIProvider throws (missing API key / model)", async () => {
    const config = makeConfig({
      getUserConfig: async () => ({
        folders: [],
        tmdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
        selectedAIProvider: "openai",
        aiProviders: [
          {
            name: "openai",
            baseURL: "https://example.invalid",
            apiKey: "",
            model: "gpt-4o-mini",
          },
        ],
      }),
      createAIProvider: () => {
        throw new Error("apiKey is required for provider \"openai\"");
      },
    });

    const response = await doChat(
      config,
      makeRequest({ clientId: "x" }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toMatch(/apiKey is required/);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const config = makeConfig({
      getUserConfig: async () => ({
        folders: [],
        tmdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
        selectedAIProvider: "openai",
        aiProviders: [
          {
            name: "openai",
            baseURL: "https://example.invalid",
            apiKey: "sk-x",
            model: "gpt-4o-mini",
          },
        ],
      }),
      // Returns a provider stub so the early-out branch falls through
      // to the JSON parse. We do not actually call `streamText` because
      // the JSON parse fails first.
      createAIProvider: () => ({
        provider: {} as never,
        model: "gpt-4o-mini",
      }),
    });

    const response = await doChat(config, makeRequest("not-json"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 499 when the request was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      signal: controller.signal,
    });
    const response = await doChat(makeConfig(), request);
    expect(response.status).toBe(499);
  });
});
