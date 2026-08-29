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
}));

vi.mock("@/coreRoutesPort", () => ({
  resolveCoreRoutesPort: vi.fn(() => 0),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { startCoreRoutesServer, stopCoreRoutesServer } from "./coreRoutesServer";

describe("startCoreRoutesServer", () => {
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

  it("passes Core's userDataDir to the shared plan routes", async () => {
    const server = await startCoreRoutesServer();

    try {
      const config = createCoreRoutesRequestHandler.mock.calls[0]?.[0] as {
        appDataDir: string;
      };
      expect(config.appDataDir).toBe("/core/user-data");
    } finally {
      await stopCoreRoutesServer(server);
    }
  });
});
