#!/usr/bin/env bun

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

const DEFAULT_MCP_URL = "http://localhost:3000/mcp";

interface Args {
  tool: string | null;
  args: string | null;
  help: boolean;
}

function printHelp(): void {
  console.log(`
Usage: bun test/mcp-test-client/index.ts --tool <tool-name> [options]

Options:
  --tool <name>     Name of the MCP tool to invoke (required)
  --args <json>     JSON string containing tool parameters (optional)
  --help            Show this help message

Examples:
  bun test/mcp-test-client/index.ts --tool get-application-context
  bun test/mcp-test-client/index.ts --tool list-files --args '{"path": "/path/to/folder"}'

Environment Variables:
  SMM_MCP_URL       MCP server URL (default: http://localhost:3000/mcp)
`);
}

function parseArgs(): Args {
  const args: Args = {
    tool: null,
    args: null,
    help: false,
  };

  const argv = Bun.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--tool" || arg === "-t") {
      if (i + 1 >= argv.length) {
        console.error("Error: --tool requires a value");
        process.exit(1);
      }
      args.tool = argv[i + 1];
      i++;
      continue;
    }

    if (arg === "--args" || arg === "-a") {
      if (i + 1 >= argv.length) {
        console.error("Error: --args requires a value");
        process.exit(1);
      }
      args.args = argv[i + 1];
      i++;
      continue;
    }

    // Handle --tool=value and --args=value format
    if (arg.startsWith("--tool=")) {
      args.tool = arg.substring(7);
      continue;
    }
    if (arg.startsWith("--args=")) {
      args.args = arg.substring(7);
      continue;
    }

    console.error(`Error: Unknown flag: ${arg}`);
    process.exit(1);
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.tool) {
    console.error("Error: --tool flag is required");
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  const mcpUrl = process.env.SMM_MCP_URL || DEFAULT_MCP_URL;

  let mcpClient: MCPClient | undefined;

  try {
    // Create MCP client with HTTP transport
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: mcpUrl,
      },
    });

    // Get available tools (schema discovery mode)
    const tools = await mcpClient.tools();

    // Validate tool name exists
    const toolName = args.tool;
    const tool = tools[toolName];

    if (!tool) {
      console.error(`Error: Tool '${toolName}' not found`);
      console.error("\nAvailable tools:");
      const toolNames = Object.keys(tools).sort();
      for (const name of toolNames) {
        console.error(`  - ${name}`);
      }
      process.exit(1);
    }

    // Parse arguments if provided
    let parsedArgs: Record<string, unknown> = {};

    if (args.args) {
      try {
        parsedArgs = JSON.parse(args.args);
      } catch (error) {
        console.error(`Error: Invalid JSON in --args: ${args.args}`);
        console.error((error as Error).message);
        process.exit(1);
      }
    }

    // Invoke the tool
    const result = await tool.execute(parsedArgs, {
      messages: [],
      toolCallId: `call-${Date.now()}`,
    });

    // Handle different response types
    if (result.isError) {
      // Tool returned an error
      const errorContent = result.content;
      console.error("Tool error:");
      console.error(JSON.stringify(errorContent, null, 2));
      process.exit(1);
    }

    // Format and print result
    if (result.content) {
      // Try to extract structured content if available
      const structuredContent = (result.content as Array<{
        type: string;
        text?: string;
        data?: unknown;
      }>).find((c) => c.type === "text" && c.text);

      if (structuredContent?.text) {
        try {
          // Try to parse as JSON for pretty printing
          const parsed = JSON.parse(structuredContent.text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          // Not JSON, print as-is
          console.log(structuredContent.text);
        }
      } else {
        // Print raw content
        console.log(JSON.stringify(result.content, null, 2));
      }
    } else {
      console.log("Tool executed successfully (no content returned)");
    }

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        console.error(`Error: Cannot connect to MCP server at ${mcpUrl}`);
        console.error("Make sure the SMM MCP server is running.");
        process.exit(1);
      }
      if (error.message.includes("fetch") || error.message.includes("network")) {
        console.error(`Error: Network error connecting to MCP server at ${mcpUrl}`);
        console.error(error.message);
        process.exit(1);
      }
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  } finally {
    // Clean up MCP client
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}

main();
