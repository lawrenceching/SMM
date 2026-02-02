import { z } from 'zod';
import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';

interface IsFolderExistResult {
  exists: boolean;
  path: string;
  reason?: string;
}

async function checkFolderExists(path: string): Promise<IsFolderExistResult> {
  if (!path || typeof path !== "string" || path.trim() === "") {
    return { exists: false, path: "", reason: "Invalid path: path must be a non-empty string" };
  }

  try {
    const normalizedPath = Path.toPlatformPath(path);
    const stats = await stat(normalizedPath);

    if (stats.isDirectory()) {
      return { exists: true, path: normalizedPath };
    } else {
      return { exists: false, path: normalizedPath, reason: "Path exists but is not a directory" };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTFOUND") {
      return { exists: false, path: path, reason: "Path does not exist" };
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error checking folder existence: ${message}`);
  }
}

export function getTool(clientId?: string): ToolDefinition {
  return {
    toolName: 'is-folder-exist',
    description: 'Check if a folder exists at the specified path. Accepts paths in POSIX or Windows format.',
    inputSchema: z.object({
      path: z.string().describe("The absolute path of the folder to check"),
    }),
    outputSchema: z.object({
      exists: z.boolean().describe("Whether the folder exists"),
      path: z.string().describe("The normalized path that was checked"),
      reason: z.string().optional().describe("Reason for non-existence or non-directory"),
    }).describe("Result of folder existence check"),
    execute: async ({ path }: { path: string }) => {
      try {
        const result = await checkFolderExists(path);
        if (!result.exists && result.reason) {
          return createSuccessResponse(result);
        }
        return createSuccessResponse(result);
      } catch (error) {
        console.error('[isFolderExist] Error:', error);
        return createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    },
  };
}

export function isFolderExistAgentTool(clientId: string) {
  return {
    description: getTool(clientId).description,
    inputSchema: getTool(clientId).inputSchema,
    outputSchema: getTool(clientId).outputSchema,
    execute: (args: any) => getTool(clientId).execute(args),
  };
}

export function isFolderExistMcpTool() {
  return getTool();
}

// Keep the original export for backward compatibility
export const isFolderExistTool = {
  description: "Check if the folder exists in the file system",
  inputSchema: z.object({
    path: z.string().describe("The absolute path of the media folder in POSIX or Windows format"),
  }),
  execute: async ({ path }: { path: string }, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    const result = await checkFolderExists(path);
    return result;
  },
};
