import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserConfig } from "@smm/types";
import type { ChatConfig, ChatRequestBody } from "./chatTypes.ts";

const streamTextMock = vi.fn();
const toUIMessageStreamMock = vi.fn(() => new ReadableStream());
const createUIMessageStreamResponseMock = vi.fn(
  ({ stream }: { stream: ReadableStream }) =>
    new Response(stream, { status: 200 }),
);

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: (...args: unknown[]) => streamTextMock(...args),
    toUIMessageStream: (...args: unknown[]) => toUIMessageStreamMock(...args),
    createUIMessageStreamResponse: (...args: unknown[]) =>
      createUIMessageStreamResponseMock(...args),
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
      stopWhen?: unknown;
    };
    expect(opts.instructions).toBe("You are a test assistant.");
    expect(opts.system).toBeUndefined();
    // stopWhen must be the predicate from isStepCount(100)
    expect(typeof opts.stopWhen).toBe("function");
    expect(opts.stopWhen).toEqual(isStepCount(100));

    expect(toUIMessageStreamMock).toHaveBeenCalled();
    expect(createUIMessageStreamResponseMock).toHaveBeenCalled();
  });
});
