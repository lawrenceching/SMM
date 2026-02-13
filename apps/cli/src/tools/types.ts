import type z from "zod";
import type { McpToolResponse } from "@/mcp/tools/mcpToolBase";

/**
 * This interface defines the structure of MCP Server Tool and AI Client Tool.
 * SMM acts as:
 *  * MCP Server that allow external AI assistants to connect to.
 *  * AI Agent that user can chat with AI assistant builtin in SMM
 */
export interface ToolDefinition {

    description: string;
    toolName: string;
    inputSchema: z.ZodSchema;
    outputSchema: z.ZodSchema;
    execute: (args: any) => Promise<McpToolResponse>;

}