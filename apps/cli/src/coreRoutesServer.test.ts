import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createCoreRoutesRequestHandler } = vi.hoisted(() => ({
  createCoreRoutesRequestHandler: vi.fn(
    (_config: unknown) =>
      (_request: IncomingMessage, response: ServerResponse) =>
        response.end(),
  ),
}));

vi.mock("@smm/core-routes", () => ({
  createCoreRoutesRequestHandler,
}));

vi.mock("@/utils/buildAllowlist", () => ({
  buildAllowlist: vi.fn(async () => []),
}));

vi.mock("@/cli/helloHttp", () => ({
  buildHelloHttpResponse: vi.fn(() => ({ data: null, error: null })),
}));

vi.mock("@/utils/socketIO", () => ({
  broadcast: vi.fn(),
  acknowledge: vi.fn(),
}));

vi.mock("../lib/ai-provider", () => ({
  createAIProvider: vi.fn(),
}));

vi.mock("@/mcp/bunMcpLifecycleManager", () => ({
  getBunMcpLifecycleManager: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), getStatus: vi.fn() })),
}));

vi.mock("@/core/getCore", () => ({
  getCore: vi.fn(() => ({})),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createCliCoreRoutesHandler } from "./coreRoutesServer";

describe("createCliCoreRoutesHandler", () => {
  let previousUserDataDir: string | undefined;
  let previousAppDataDir: string | undefined;

  beforeEach(() => {
    previousUserDataDir = process.env.USER_DATA_DIR;
    previousAppDataDir = process.env.APP_DATA_DIR;
    process.env.USER_DATA_DIR = "/core/user-data";
    process.env.APP_DATA_DIR = "/metadata/app-data";
  });

  afterEach(() => {
    if (previousUserDataDir === undefined) delete process.env.USER_DATA_DIR;
    else process.env.USER_DATA_DIR = previousUserDataDir;
    if (previousAppDataDir === undefined) delete process.env.APP_DATA_DIR;
    else process.env.APP_DATA_DIR = previousAppDataDir;
    vi.clearAllMocks();
  });

  it("passes Core's appDataDir and chat/mcp to the shared handler", async () => {
    const helloHolder = { resolve: () => ({}) as never };
    await createCliCoreRoutesHandler(30000, helloHolder);

    const config = createCoreRoutesRequestHandler.mock.calls[0]?.[0] as {
      appDataDir: string;
      chat: unknown;
      mcp: unknown;
    };
    expect(config.appDataDir).toBe("/metadata/app-data");
    expect(config.chat).toBeDefined();
    expect(config.mcp).toBeDefined();
  });
});
