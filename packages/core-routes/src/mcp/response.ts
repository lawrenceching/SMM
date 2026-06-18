import type { McpToolResponse } from "./types.ts";

/**
 * Build a success MCP tool response. The payload is serialised to
 * JSON inside the `content[0].text` field and is also exposed via
 * `structuredContent` for clients that prefer the structured form.
 */
export function createSuccessResponse(data: {
  [x: string]: unknown;
}): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

/**
 * Build an error MCP tool response with a plain-text message.
 * The error is flagged via `isError: true` so the MCP client can
 * surface it as a tool failure.
 */
export function createErrorResponse(message: string): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
