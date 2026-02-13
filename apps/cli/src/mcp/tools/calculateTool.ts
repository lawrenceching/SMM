import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCalculateTool(server: McpServer) {
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
      
}