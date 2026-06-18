#!/usr/bin/env bun
/**
 * Quick test to exercise the apps/cli MCP server stack and capture
 * the diagnostic logs from `createServer.ts` and `apps/cli/mcp.ts`.
 *
 * Spins up Bun.serve on 127.0.0.1:30001, sends an `initialize`
 * request, then a `tools/list` request, and prints the responses.
 */

import { getMcpStreamableHttpHandler } from "../apps/cli/src/mcp/mcp"

const HOST = "127.0.0.1"
const PORT = 30099

async function main() {
  console.log("[test] building MCP handler...")
  const handler = await getMcpStreamableHttpHandler()
  console.log("[test] MCP handler ready, starting server...")

  const server = Bun.serve({
    hostname: HOST,
    port: PORT,
    fetch: handler,
  })
  console.log(`[test] server listening on http://${HOST}:${PORT}`)

  // === Send initialize ===
  console.log("\n[test] === initialize request ===")
  const initRes = await fetch(`http://${HOST}:${PORT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
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
  console.log(`[test] initialize response status: ${initRes.status}`)
  console.log(`[test] initialize response ctor: ${initRes.constructor.name}`)
  console.log(`[test] initialize content-type: ${initRes.headers.get("content-type")}`)
  const initText = await initRes.text()
  console.log(`[test] initialize body (first 500 chars): ${initText.slice(0, 500)}`)

  // === Send notifications/initialized ===
  console.log("\n[test] === notifications/initialized ===")
  const notifyRes = await fetch(`http://${HOST}:${PORT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  })
  console.log(`[test] notify response status: ${notifyRes.status}`)

  // === Send tools/list ===
  console.log("\n[test] === tools/list request ===")
  const listRes = await fetch(`http://${HOST}:${PORT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  })
  console.log(`[test] tools/list response status: ${listRes.status}`)
  console.log(`[test] tools/list response ctor: ${listRes.constructor.name}`)
  console.log(`[test] tools/list content-type: ${listRes.headers.get("content-type")}`)
  const listText = await listRes.text()
  console.log(`[test] tools/list body: ${listText.slice(0, 2000)}`)

  server.stop()
  console.log("\n[test] done")
}

main().catch((err) => {
  console.error("[test] FAILED:", err)
  process.exit(1)
})
