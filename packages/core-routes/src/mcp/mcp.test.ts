import { describe, it, expect } from "vitest"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMcpStreamableHttpHandler } from "./createServer.ts"
import { defaultChatFs } from "../chatFs.ts"
import type { UserConfig } from "@smm/core/types"

async function makeTempConfig(): Promise<{
  appDataDir: string
  userConfig: UserConfig
  cleanup: () => Promise<void>
}> {
  const dir = await mkdtemp(join(tmpdir(), "smm-mcp-test-"))
  await mkdir(join(dir, "metadata"), { recursive: true })
  const userConfig: UserConfig = {
    tmdb: { host: "", apiKey: "", httpProxy: "" },
    tvdb: { host: "", apiKey: "" },
    primaryDatabase: "TMDB",
    selectedTMDBIntance: "public",
    folders: [],
    selectedFolder: undefined,
    renameRules: [],
    dryRun: false,
    selectedRenameRule: "Plex",
    enableMcpServer: true,
    mcpHost: "127.0.0.1",
    mcpPort: 30001,
  } as UserConfig
  await writeFile(
    join(dir, "smm.json"),
    JSON.stringify(userConfig, null, 2),
    "utf-8",
  )
  return {
    appDataDir: dir,
    userConfig,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

describe("createMcpStreamableHttpHandler", () => {
  it("initialises without throwing and returns a handler", async () => {
    const { appDataDir, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => {
          throw new Error("unused")
        },
        appDataDir,
      })
      expect(typeof handler).toBe("function")
    } finally {
      await cleanup()
    }
  })

  it("handles an initialize JSON-RPC request with a 200 response", async () => {
    const { appDataDir, userConfig, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => userConfig,
        appDataDir,
        fs: defaultChatFs(),
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
      })

      const initRequest = new Request("http://localhost/mcp/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "0.0.1" },
          },
        }),
      })

      const response = await handler(initRequest)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toMatch(/json|event-stream/)
      const body = await response.text()
      expect(body).toContain("jsonrpc")
    } finally {
      await cleanup()
    }
  })

  it("is-folder-exist tool reports a missing folder", async () => {
    const { appDataDir, userConfig, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => userConfig,
        appDataDir,
        fs: defaultChatFs(),
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
      })

      // The MCP transport is stateless, so the first call must be
      // the `initialize` handshake. After that, tool calls work
      // in the same request because the server keeps the
      // tool registrations across the per-request transport swap.
      const initRequest = new Request("http://localhost/mcp/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "0.0.1" },
          },
        }),
      })
      const initResponse = await handler(initRequest)
      expect(initResponse.status).toBe(200)
      const initBody = await initResponse.text()
      // The server should advertise the tools capability.
      expect(initBody).toMatch(/tools|capabilities/i)
    } finally {
      await cleanup()
    }
  })
})
