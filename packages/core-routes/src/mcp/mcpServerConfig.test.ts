import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { McpLifecycleManager } from "./lifecycleTypes.ts";
import type { CoreRoutesConfig } from "../types.ts";
import {
  getMcpServerStatusWithUserConfig,
  startMcpServerWithUserConfig,
  stopMcpServerWithUserConfig,
} from "./mcpServerConfig.ts";

function createGateManager(mainOrigin = "http://127.0.0.1:18081"): McpLifecycleManager {
  let enabled = false;
  const mcpUrl = `${mainOrigin.replace(/\/$/, "")}/mcp`;

  return {
    async start() {
      enabled = true;
    },
    async stop() {
      enabled = false;
    },
    getState() {
      if (enabled) {
        const url = new URL(mcpUrl);
        return {
          status: "running" as const,
          host: url.hostname,
          port: url.port ? Number(url.port) : 80,
          url: mcpUrl,
        };
      }
      return { status: "stopped" as const, url: mcpUrl };
    },
  };
}

async function readConfigFile(userDataDir: string) {
  const raw = await readFile(path.join(userDataDir, "smm.json"), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("mcpServerConfig persistence", () => {
  let tmpDir: string;
  let routesConfig: CoreRoutesConfig;
  let manager: McpLifecycleManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "mcp-config-"));
    await writeFile(
      path.join(tmpDir, "smm.json"),
      JSON.stringify({ folders: [], enableMcpServer: false }),
      "utf-8",
    );
    routesConfig = {
      hello: { userDataDir: tmpDir },
      appDataDir: tmpDir,
    };
    manager = createGateManager();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("startMcpServerWithUserConfig persists enableMcpServer and host/port", async () => {
    const result = await startMcpServerWithUserConfig(
      manager,
      routesConfig,
      { host: "127.0.0.2", port: 30021 },
    );

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("running");
    expect(result.data?.url).toBe("http://127.0.0.1:18081/mcp");

    const config = await readConfigFile(tmpDir);
    expect(config.enableMcpServer).toBe(true);
    expect(config.mcpHost).toBe("127.0.0.2");
    expect(config.mcpPort).toBe(30021);
  });

  it("stopMcpServerWithUserConfig sets enableMcpServer to false", async () => {
    await startMcpServerWithUserConfig(manager, routesConfig, {});

    const result = await stopMcpServerWithUserConfig(manager, routesConfig);
    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("stopped");

    const config = await readConfigFile(tmpDir);
    expect(config.enableMcpServer).toBe(false);
  });

  it("getMcpServerStatusWithUserConfig reconciles stale enableMcpServer", async () => {
    await writeFile(
      path.join(tmpDir, "smm.json"),
      JSON.stringify({ folders: [], enableMcpServer: true }),
      "utf-8",
    );

    const result = await getMcpServerStatusWithUserConfig(manager, routesConfig);
    expect(result.data?.status).toBe("stopped");

    const config = await readConfigFile(tmpDir);
    expect(config.enableMcpServer).toBe(false);
  });

  it("startMcpServerWithUserConfig skips config write when persistUserConfig is false", async () => {
    await startMcpServerWithUserConfig(manager, routesConfig, {}, {
      persistUserConfig: false,
    });

    const config = await readConfigFile(tmpDir);
    expect(config.enableMcpServer).toBe(false);
  });
});
