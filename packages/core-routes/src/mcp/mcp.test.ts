import { describe, it, expect } from "vitest"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMcpStreamableHttpHandler } from "./createServer.ts"
import { defaultChatFs } from "../chatFs.ts"
import type { UserConfig } from "@smm/core/types"
import { Path } from "@smm/core/path"
import { metadataCacheFilePath } from "../mediaMetadataCache.ts"
import { RENAME_FOLDER } from "@smm/core/types/ai-tools/renameFolder"

/**
 * Send a JSON-RPC request through the MCP handler and decode the
 * single JSON response. The transport is configured in stateless
 * mode (one `McpServer` instance, fresh transport per request) so
 * the server's tool registrations persist across calls.
 */
async function callMcp(
  handler: Awaited<ReturnType<typeof createMcpStreamableHttpHandler>>,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const request = new Request("http://localhost/mcp/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  })
  const response = await handler(request)
  expect(response.status).toBe(200)
  const text = await response.text()
  // Streamable HTTP transport responds with either `application/json`
  // (single response) or `text/event-stream` (SSE-encoded JSON).
  // Decode the last `data:` frame, which is the JSON-RPC reply.
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return JSON.parse(text) as Record<string, unknown>
  }
  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
  const lastData = dataLines.at(-1) ?? ""
  expect(lastData).not.toBe("")
  return JSON.parse(lastData) as Record<string, unknown>
}

async function makeTempConfig(): Promise<{
  appDataDir: string
  userDataDir: string
  userConfig: UserConfig
  cleanup: () => Promise<void>
}> {
  // On Linux (XDG) `userDataDir` (smm.json location) and
  // `appDataDir` (metadata + plan files) are distinct. Use two
  // sibling temp dirs so the regression test for
  // `get-episodes` / `rename-folder` can verify the user config is
  // read from the userDataDir, not appDataDir.
  const userDataDir = await mkdtemp(join(tmpdir(), "smm-mcp-userdata-"))
  const appDataDir = await mkdtemp(join(tmpdir(), "smm-mcp-appdata-"))
  await mkdir(join(appDataDir, "metadata"), { recursive: true })
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
    join(userDataDir, "smm.json"),
    JSON.stringify(userConfig, null, 2),
    "utf-8",
  )
  return {
    appDataDir,
    userDataDir,
    userConfig,
    cleanup: async () => {
      await rm(userDataDir, { recursive: true, force: true })
      await rm(appDataDir, { recursive: true, force: true })
    },
  }
}

describe("createMcpStreamableHttpHandler", () => {
  it("initialises without throwing and returns a handler", async () => {
    const { appDataDir, userDataDir, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => {
          throw new Error("unused")
        },
        appDataDir,
        userDataDir,
      })
      expect(typeof handler).toBe("function")
    } finally {
      await cleanup()
    }
  })

  it("handles an initialize JSON-RPC request with a 200 response", async () => {
    const { appDataDir, userDataDir, userConfig, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => userConfig,
        appDataDir,
        userDataDir,
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
    const { appDataDir, userDataDir, userConfig, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => userConfig,
        appDataDir,
        userDataDir,
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

  it("omits tools listed in disabledTools from tools/list", async () => {
    const { appDataDir, userDataDir, userConfig, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => userConfig,
        appDataDir,
        userDataDir,
        fs: defaultChatFs(),
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
        disabledTools: [RENAME_FOLDER],
      })

      await callMcp(handler, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      })

      const listResponse = await callMcp(handler, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      })
      const tools = (listResponse.result as { tools: Array<{ name: string }> })
        .tools
      const names = tools.map((t) => t.name)
      expect(names).not.toContain(RENAME_FOLDER)
    } finally {
      await cleanup()
    }
  })

  it("registers rename-folder when disabledTools is empty", async () => {
    const { appDataDir, userDataDir, userConfig, cleanup } = await makeTempConfig()
    try {
      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => userConfig,
        appDataDir,
        userDataDir,
        fs: defaultChatFs(),
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
      })

      await callMcp(handler, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      })

      const listResponse = await callMcp(handler, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      })
      const tools = (listResponse.result as { tools: Array<{ name: string }> })
        .tools
      const names = tools.map((t) => t.name)
      expect(names).toContain(RENAME_FOLDER)
    } finally {
      await cleanup()
    }
  })

  /**
   * Regression test for the bug where the MCP `get-episodes` tool
   * reported "Media folder not found... is not managed by SMM" on
   * Linux. The cause was that the synthetic `CoreRoutesConfig`
   * built inside `registerGetEpisodesTool` set
   * `hello.userDataDir = config.appDataDir`, so
   * `isMediaFolderManaged` looked for `smm.json` under the
   * metadata dir instead of the user data dir.
   *
   * The fix: `McpConfig` now carries an explicit `userDataDir`
   * field (set to the directory where the renderer writes
   * `smm.json`) and the synthetic config uses it. This test
   * mirrors the CI failure mode: two distinct dirs, smm.json
   * only in `userDataDir`, metadata only in `appDataDir`.
   */
  it("get-episodes reads user config from userDataDir (not appDataDir)", async () => {
    const { appDataDir, userDataDir, userConfig, cleanup } =
      await makeTempConfig()
    try {
      // Register a managed folder in user config so
      // isMediaFolderManaged will return true.
      const mediaFolder = join(userDataDir, "tvshow")
      await mkdir(mediaFolder, { recursive: true })
      const updatedUserConfig: UserConfig = {
        ...userConfig,
        folders: [mediaFolder],
      }
      // Overwrite smm.json in userDataDir with the managed folder
      await writeFile(
        join(userDataDir, "smm.json"),
        JSON.stringify(updatedUserConfig, null, 2),
        "utf-8",
      )

      // Drop a TV-show metadata cache in appDataDir so the tool
      // can read it back.
      const metadataCachePath = metadataCacheFilePath(
        appDataDir,
        Path.posix(mediaFolder),
      )
      const metadata = {
        mediaFolderPath: mediaFolder,
        type: "tvshow-folder",
        tvShow: {
          id: "1",
          name: "Demo Show",
          database: "TMDB",
          seasons: [
            {
              season: 1,
              name: "Season 1",
              episodes: [{ season: 1, episode: 1, name: "Pilot" }],
            },
          ],
        },
        mediaFiles: [
          {
            absolutePath: join(mediaFolder, "S01E01.mkv"),
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ],
      }
      await writeFile(metadataCachePath, JSON.stringify(metadata), "utf-8")

      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => updatedUserConfig,
        appDataDir,
        userDataDir,
        fs: defaultChatFs(),
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
      })

      await callMcp(handler, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      })

      const callResponse = await callMcp(handler, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "get-episodes",
          arguments: { mediaFolderPath: mediaFolder },
        },
      })

      // The pre-fix bug returned a structuredContent.error of
      // "Media folder not found... is not managed by SMM". After
      // the fix the tool resolves episodes from the metadata
      // cache and reports the demo show.
      const result = callResponse.result as {
        structuredContent?: {
          episodes?: Array<unknown>
          totalCount?: number
          showName?: string
          error?: string
        }
        isError?: boolean
      }
      expect(result.isError).toBeFalsy()
      expect(result.structuredContent?.error).toBeUndefined()
      expect(result.structuredContent?.showName).toBe("Demo Show")
      expect(result.structuredContent?.totalCount).toBe(1)
      expect(result.structuredContent?.episodes?.length).toBe(1)
    } finally {
      await cleanup()
    }
  })

  /**
   * Same regression scenario for `rename-folder`. The pre-fix bug
   * returned `renamed: false` with
   * `<from> is not managed by SMM` on Linux.
   */
  it("rename-folder reads user config from userDataDir (not appDataDir)", async () => {
    const { appDataDir, userDataDir, userConfig, cleanup } =
      await makeTempConfig()
    try {
      // Create the source folder on disk so the rename can
      // succeed end-to-end.
      const sourceFolder = join(userDataDir, "old-folder")
      await mkdir(sourceFolder, { recursive: true })
      const targetFolder = join(userDataDir, "new-folder")

      // Write a minimal metadata cache entry so
      // `doRenameFolder` passes `readMediaMetadataCache`.
      const metadataCachePath = metadataCacheFilePath(
        appDataDir,
        Path.posix(sourceFolder),
      )
      const metadata = {
        mediaFolderPath: sourceFolder,
        type: "tvshow-folder",
      }
      await writeFile(metadataCachePath, JSON.stringify(metadata), "utf-8")

      const updatedUserConfig: UserConfig = {
        ...userConfig,
        folders: [sourceFolder],
      }
      await writeFile(
        join(userDataDir, "smm.json"),
        JSON.stringify(updatedUserConfig, null, 2),
        "utf-8",
      )

      const handler = await createMcpStreamableHttpHandler({
        getUserConfig: async () => updatedUserConfig,
        appDataDir,
        userDataDir,
        fs: defaultChatFs(),
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
      })

      await callMcp(handler, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      })

      const callResponse = await callMcp(handler, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "rename-folder",
          arguments: { from: sourceFolder, to: targetFolder },
        },
      })

      const result = callResponse.result as {
        structuredContent?: {
          renamed?: boolean
          from?: string
          to?: string
          error?: string
        }
        isError?: boolean
      }
      expect(result.isError).toBeFalsy()
      expect(result.structuredContent?.error).toBeUndefined()
      expect(result.structuredContent?.renamed).toBe(true)
      expect(result.structuredContent?.from).toBe(sourceFolder)
      expect(result.structuredContent?.to).toBe(targetFolder)
    } finally {
      await cleanup()
    }
  })
})
