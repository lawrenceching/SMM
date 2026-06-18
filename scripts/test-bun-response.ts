// Test if Bun.serve rejects responses from the MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

const server = new McpServer(
  { name: "test", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.tool("test-tool", "test", {}, async () => {
  return { content: [{ type: "text", text: "hello" }] };
});

const transport = new WebStandardStreamableHTTPServerTransport({});
await server.connect(transport);

const server1 = Bun.serve({
  hostname: "127.0.0.1",
  port: 30098,
  fetch: async (req) => {
    console.log("handler invoked, method:", req.method);
    const r = await transport.handleRequest(req);
    console.log("response ctor:", r.constructor.name, "status:", r.status);
    return r;
  },
});

console.log("server started on 30098");

const initRes = await fetch("http://127.0.0.1:30098/", {
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
});

console.log("init response status:", initRes.status, "ctor:", initRes.constructor.name);

server1.stop();
console.log("done");
