import type { z } from "zod";

/**
 * Shape of an agent tool built for AI SDK's `streamText` `tools` map.
 *
 * `build` is a factory that takes the per-request context (clientId,
 * abortSignal, etc.) and returns the AI-SDK-compatible tool object.
 * The {@link ToolDescriptor} is the registered, framework-neutral
 * description of a tool.
 */
export interface AgentTool {
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  execute: (args: unknown) => Promise<unknown>;
}

/**
 * Factory for an {@link AgentTool}. The factory receives the per-
 * request context (clientId, abortSignal) so each request can build
 * a tool bound to its own socket / cancellation.
 */
export type AgentToolFactory = (ctx: AgentToolContext) => AgentTool;

export interface AgentToolContext {
  /** UI-side socket id; tools that need to ask the UI for input use this. */
  clientId: string;
  /** Abort signal from the chat request; tools that fetch I/O honor it. */
  abortSignal: AbortSignal | undefined;
}

/**
 * Registry entry for a single agent tool. `inputSchema` and
 * `outputSchema` come from `@core/types/ai-tools/*` and are reused by
 * MCP tools, agent tools, and tests.
 */
export interface ToolDescriptor {
  /** AI tool name constant from `@core/types/ai-tools/*`. */
  toolName: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  build: AgentToolFactory;
}
