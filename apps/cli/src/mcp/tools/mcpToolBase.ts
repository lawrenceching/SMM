import { Path } from "@core/path";

/**
 * Standard MCP tool response interface.
 *
 * Mirrors the `McpToolResponse` shape used by the MCP server
 * factory in `@smm/core-routes/src/mcp/`. Lives in `apps/cli`
 * because the agent tool wrappers in `apps/cli/src/tools/*` still
 * return this shape for the chat pipeline and debug routes.
 */
export interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;
    annotations?: {
      audience?: ("user" | "assistant")[];
      priority?: number;
      lastModified?: string;
    };
    _meta?: { [key: string]: unknown };
  }>;
  structuredContent?: { [x: string]: unknown };
  isError?: boolean;
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Create a success MCP tool response. The payload is serialised to
 * JSON inside `content[0].text` and exposed via `structuredContent`
 * for clients that prefer the structured form.
 */
export function createSuccessResponse(data: { [x: string]: unknown }): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

/**
 * Create an error MCP tool response. The error is flagged via
 * `isError: true` so the MCP client can surface it as a tool
 * failure.
 */
export function createErrorResponse(message: string): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/**
 * Normalize a path to platform-specific format.
 */
export function normalizePath(path: string): string {
  return Path.toPlatformPath(path);
}

/**
 * Convert a path to POSIX format for internal operations.
 */
export function toPosixPath(path: string): string {
  return Path.posix(path);
}
