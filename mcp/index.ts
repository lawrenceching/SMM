import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "demo-mcp-server",
  version: "1.0.0",
});

// ============================================
// 1. TOOL: Calculator
// ============================================
server.registerTool(
  "calculate",
  {
    description: "Perform basic arithmetic calculations",
    inputSchema: {
      expression: z
        .string()
        .describe("Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')"),
    },
  } as any,
  async (args: any) => {
    const { expression } = args;
    try {
      // Safe evaluation of simple math expressions
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
      const result = Function(`"use strict"; return (${sanitized})`)();

      return {
        content: [
          {
            type: "text",
            text: `Result: ${expression} = ${result}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Invalid expression "${expression}"`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================
// 2. RESOURCE: Server Information (using URI string)
// ============================================
server.registerResource(
  "server-info",
  "info://server",
  {
    description: "Server information and status",
    mimeType: "application/json",
  },
  async () => {
    const info = {
      name: "Demo MCP Server",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      capabilities: {
        tools: ["calculate"],
        resources: ["server-info"],
        prompts: ["greeting"],
      },
    };

    return {
      contents: [
        {
          uri: "info://server",
          mimeType: "application/json",
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }
);

// ============================================
// 3. PROMPT: Greeting Template
// ============================================
server.registerPrompt(
  "greeting",
  {
    description: "Generate a personalized greeting message",
    argsSchema: {
      name: z.string().describe("Name of the person to greet"),
      tone: z
        .enum(["formal", "casual", "friendly"])
        .default("friendly")
        .describe("Tone of the greeting"),
    },
  } as any,
  async (args: any) => {
    const { name, tone = "friendly" } = args;
    const greetings = {
      formal: `Good day, ${name}. I hope this message finds you well. How may I assist you today?`,
      casual: `Hey ${name}! What's up?`,
      friendly: `Hello ${name}! 😊 Great to see you! How can I help you today?`,
    };

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: greetings[tone as keyof typeof greetings],
          },
        },
      ],
    };
  }
);

// ============================================
// Start Server with Streamable HTTP Transport
// ============================================
const PORT = parseInt(process.env.PORT || "3000");

async function main() {
  const transport = new WebStandardStreamableHTTPServerTransport({
    // sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);

  console.log(`Demo MCP Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log("\nAvailable capabilities:");
  console.log("  Tool: calculate - Perform arithmetic calculations");
  console.log("  Resource: server-info - Server information");
  console.log("  Prompt: greeting - Generate greeting messages");

  // Start Bun HTTP server
  Bun.serve({
    port: PORT,
    fetch: async (req) => {
      // Route MCP requests to the transport handler
      const url = new URL(req.url);
      if (url.pathname === "/mcp") {
        return transport.handleRequest(req);
      }

      // Health check endpoint
      return new Response(
        JSON.stringify({
          name: "Demo MCP Server",
          version: "1.0.0",
          mcpEndpoint: `/mcp`,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  });

  console.log(`\nServer is now listening for requests...`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
