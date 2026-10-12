import { logAccess, serializeErrorForLog, truncateForLog } from "../accessLog.ts";
import type { CoreRoutesLogger } from "../types.ts";

export interface AccessLoggedToolContext {
  logger: CoreRoutesLogger | undefined;
  clientId?: string;
}

/**
 * Wrap one chat tool's `execute` so each invocation emits a single
 * `msg:"access"` entry (source "ai-tool"): args (truncated),
 * clientId, outcome, duration. All other tool fields pass through
 * untouched. Rethrows the original error.
 */
export function withAccessLog<
  T extends { execute: (...args: never[]) => Promise<unknown> },
>(tool: T, toolName: string, ctx: AccessLoggedToolContext): T {
  const originalExecute = tool.execute.bind(tool) as (...args: unknown[]) => Promise<unknown>;
  const wrappedExecute = async (...args: unknown[]): Promise<unknown> => {
    const started = performance.now();
    const callArgs = args[0];
    try {
      const result = await originalExecute(...args);
      logAccess(ctx.logger, {
        source: "ai-tool",
        tool: toolName,
        args: truncateForLog(callArgs),
        clientId: ctx.clientId,
        outcome: "ok",
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      logAccess(ctx.logger, {
        source: "ai-tool",
        tool: toolName,
        args: truncateForLog(callArgs),
        clientId: ctx.clientId,
        outcome: "error",
        err: serializeErrorForLog(error),
        durationMs: Math.round(performance.now() - started),
      });
      throw error;
    }
  };
  // The wrapped execute keeps the same runtime signature; the cast
  // preserves the precise per-key ChatTools entry type.
  return { ...tool, execute: wrappedExecute } as T;
}

/**
 * Wrap every tool in a `createChatTools()` result set so a multi-step
 * agent loop is traceable via the shared `clientId`.
 */
export function withChatToolsAccessLog<T extends object>(
  tools: T,
  ctx: AccessLoggedToolContext,
): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      withAccessLog(
        tool as { execute: (...args: never[]) => Promise<unknown> },
        name,
        ctx,
      ),
    ]),
  ) as T;
}
