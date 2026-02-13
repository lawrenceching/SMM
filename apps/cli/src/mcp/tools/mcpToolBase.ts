import { Path } from "@core/path";

/**
 * Standard MCP tool response interface
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
 * Create a success response
 */
export function createSuccessResponse(data: { [x: string]: unknown }): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(message: string): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/**
 * Normalize a path to platform-specific format
 */
export function normalizePath(path: string): string {
  return Path.toPlatformPath(path);
}

/**
 * Convert a path to POSIX format for internal operations
 */
export function toPosixPath(path: string): string {
  return Path.posix(path);
}
