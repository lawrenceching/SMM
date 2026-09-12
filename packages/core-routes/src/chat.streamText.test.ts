import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserConfig } from "@smm/types";
import type { ChatConfig, ChatRequestBody } from "./chatTypes.ts";

const streamTextMock = vi.fn<(opts: unknown) => unknown>();
const toUIMessageStreamMock = vi.fn<(opts: unknown) => ReadableStream>(
  () => new ReadableStream(),
);
const createUIMessageStreamResponseMock = vi.fn(
  ({ stream }: { stream: ReadableStream }) =>
    new Response(stream, { status: 200 }),
);

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: (opts: unknown) => streamTextMock(opts),
    toUIMessageStream: (opts: unknown) => toUIMessageStreamMock(opts),
    createUIMessageStreamResponse: (opts: unknown) =>
      createUIMessageStreamResponseMock(
        opts as Parameters<typeof createUIMessageStreamResponseMock>[0],
      ),
    convertToModelMessages: vi.fn(async () => []),
  };
});

vi.mock("@assistant-ui/react-ai-sdk", () => ({
  frontendTools: () => ({}),
}));

vi.mock("./tools/index.ts", () => ({
  defaultChatFs: () => ({}),
  createChatTools: () =>
    new Proxy(
      {},
      {
        get: () => ({
          description: "mock",
          inputSchema: { parse: (x: unknown) => x },
          execute: async () => ({}),
        }),
      },
    ),
}));

const { doChat } = await import("./chat.ts");
const { isStepCount } = await import("ai");

function makeUserConfig(): UserConfig {
  return {
    folders: [],
    tmdb: {},
    tvdb: {},
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
  };
}

function makeConfig(): ChatConfig {
  const userConfig = makeUserConfig();
  return {
    appDataDir: "/tmp",
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    createAIProvider: async () => ({
      provider: {
        chatModel: () => ({ provider: "mock", modelId: "gpt-4o-mini" }),
      } as never,
      model: "gpt-4o-mini",
    }),
    getUserConfig: async () => userConfig,
  };
}

describe("doChat — AI SDK 7 streamText options", () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    toUIMessageStreamMock.mockReset();
    createUIMessageStreamResponseMock.mockReset();
    toUIMessageStreamMock.mockReturnValue(new ReadableStream());
    createUIMessageStreamResponseMock.mockImplementation(
      ({ stream }: { stream: ReadableStream }) =>
        new Response(stream, { status: 200 }),
    );
    streamTextMock.mockReturnValue({
      stream: new ReadableStream(),
      toUIMessageStreamResponse: () =>
        new Response(new ReadableStream(), { status: 200 }),
    });
  });

  it("maps body.system to instructions and uses isStepCount + UI stream helpers", async () => {
    const body: ChatRequestBody = {
      clientId: "c1",
      system: "You are a test assistant.",
      messages: [],
    };

    const response = await doChat(
      makeConfig(),
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(200);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const opts = streamTextMock.mock.calls[0]![0] as {
      instructions?: string;
      system?: string;
      stopWhen?: (ctx: { steps: unknown[] }) => boolean;
    };
    expect(opts).toMatchObject({
      instructions: "You are a test assistant.",
    });
    expect(opts.system).toBeUndefined();
    // isStepCount returns a new function each call — verify behavior, not identity
    expect(typeof opts.stopWhen).toBe("function");
    const steps99 = Array.from({ length: 99 }, () => ({}));
    const steps100 = Array.from({ length: 100 }, () => ({}));
    expect(opts.stopWhen!({ steps: steps99 })).toBe(false);
    expect(opts.stopWhen!({ steps: steps100 })).toBe(true);
    expect(isStepCount(100)({ steps: steps100 as never[] })).toBe(true);

    expect(toUIMessageStreamMock).toHaveBeenCalled();
    expect(createUIMessageStreamResponseMock).toHaveBeenCalled();
  });
});
