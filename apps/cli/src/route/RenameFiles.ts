import { doRenameFiles as doRenameFilesCore } from "@smm/core-routes";
import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@core/types";
import type { Hono } from "hono";
import { logger } from "../../lib/logger";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { getAppDataDir } from "@/utils/config";
import { broadcast } from "../utils/socketIO";

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export async function processRenameFiles(
  body: RenameFilesRequestBody,
  clientId?: string,
): Promise<RenameFilesResponseBody> {
  const allowlist = await buildAllowlist();
  return doRenameFilesCore(
    body,
    {
      allowlist,
      appDataDir: getAppDataDir(),
      logger: coreRoutesLogger,
      broadcast: (message) => broadcast(message),
    },
    clientId,
  );
}

export function handleRenameFiles(app: Hono): void {
  app.post("/api/renameFiles", async (c) => {
    try {
      const rawBody = await c.req.json();
      const clientId = c.req.header("clientId");
      const result = await processRenameFiles(rawBody as RenameFilesRequestBody, clientId ?? undefined);
      return c.json(result, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(
        { error: errorMessage, stack: errorStack },
        "[POST /api/renameFiles] route error",
      );
      return c.json(
        {
          error: "Unexpected Error: " + errorMessage,
        },
        200,
      );
    }
  });
}
