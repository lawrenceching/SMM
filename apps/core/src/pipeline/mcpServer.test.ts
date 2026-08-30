import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { McpServerPort, McpServerState } from "../ports/McpServerPort";
import { UserConfigHelper } from "./userConfigHelper";
import { userConfigPath } from "./paths";
import {
  getMcpServerStatusWithConfig,
  startMcpServerWithConfig,
  stopMcpServerWithConfig,
} from "./mcpServer";

function inMemoryFs(seed: Record<string, string> = {}): FsPort {
  const files = new Map(Object.entries(seed));
  return {
    readTextFile: vi.fn(async (path: string) => {
      const value = files.get(path);
      if (value === undefined) throw new Error("ENOENT: " + path);
      return value;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

function createMockPort(initial: McpServerState = { status: "stopped" }): McpServerPort & {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  let state = { ...initial };
  return {
    start: vi.fn(async ({ hostname, port }) => {
      state = {
        status: "running",
        host: hostname,
        port,
        url: `http://${hostname}:${port}/mcp`,
      };
    }),
    stop: vi.fn(async () => {
      state = { status: "stopped" };
    }),
    getState: () => ({ ...state }),
  };
}

describe("mcpServer pipeline", () => {
  it("startMcpServerWithConfig persists enableMcpServer and host/port on success", async () => {
    const fs = inMemoryFs();
    const appDataDir = "/data";
    const userConfig = new UserConfigHelper(fs, appDataDir);
    const port = createMockPort();

    const state = await startMcpServerWithConfig(
      port,
      userConfig,
      { hostname: "0.0.0.0", port: 8080 },
      { persistUserConfig: true },
    );

    expect(state.status).toBe("running");
    expect(state.url).toBe("http://0.0.0.0:8080/mcp");
    const saved = JSON.parse(
      (await fs.readTextFile(userConfigPath(appDataDir))) as string,
    );
    expect(saved.enableMcpServer).toBe(true);
    expect(saved.mcpHost).toBe("0.0.0.0");
    expect(saved.mcpPort).toBe(8080);
  });

  it("startMcpServerWithConfig does not persist when start fails", async () => {
    const fs = inMemoryFs();
    const appDataDir = "/data";
    const userConfig = new UserConfigHelper(fs, appDataDir);
    const port = createMockPort();
    port.start.mockRejectedValueOnce(new Error("port in use"));

    await expect(
      startMcpServerWithConfig(port, userConfig, {}, { persistUserConfig: true }),
    ).rejects.toThrow("port in use");

    expect(await fs.exists(userConfigPath(appDataDir))).toBe(false);
  });

  it("startMcpServerWithConfig skips config write when persistUserConfig is false", async () => {
    const fs = inMemoryFs();
    const appDataDir = "/data";
    const userConfig = new UserConfigHelper(fs, appDataDir);
    const port = createMockPort();

    await startMcpServerWithConfig(port, userConfig, {}, { persistUserConfig: false });

    expect(await fs.exists(userConfigPath(appDataDir))).toBe(false);
  });

  it("stopMcpServerWithConfig sets enableMcpServer to false", async () => {
    const fs = inMemoryFs();
    const appDataDir = "/data";
    const configPath = userConfigPath(appDataDir);
    await fs.writeTextFile(
      configPath,
      JSON.stringify({ folders: [], enableMcpServer: true, mcpHost: "127.0.0.1", mcpPort: 30001 }),
    );
    const userConfig = new UserConfigHelper(fs, appDataDir);
    const port = createMockPort({ status: "running", host: "127.0.0.1", port: 30001 });

    const state = await stopMcpServerWithConfig(port, userConfig, { persistUserConfig: true });

    expect(state.status).toBe("stopped");
    const saved = JSON.parse((await fs.readTextFile(configPath)) as string);
    expect(saved.enableMcpServer).toBe(false);
  });

  it("getMcpServerStatusWithConfig corrects enableMcpServer when server is stopped", async () => {
    const fs = inMemoryFs();
    const appDataDir = "/data";
    const configPath = userConfigPath(appDataDir);
    await fs.writeTextFile(
      configPath,
      JSON.stringify({ folders: [], enableMcpServer: true }),
    );
    const userConfig = new UserConfigHelper(fs, appDataDir);
    const port = createMockPort({ status: "stopped" });

    const state = await getMcpServerStatusWithConfig(port, userConfig);

    expect(state.status).toBe("stopped");
    const saved = JSON.parse((await fs.readTextFile(configPath)) as string);
    expect(saved.enableMcpServer).toBe(false);
  });
});
