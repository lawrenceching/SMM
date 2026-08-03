import { doRenameFiles as doRenameFilesCore, type CoreRoutesLogger } from "@smm/core-routes";
import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@core/types";
import type { Hono } from "hono";
import { logger } from "../../lib/logger";
import { broadcast } from "../utils/socketIO";
import { buildCoreRoutesConfig } from "./coreRoutesConfig";

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
};

export async function processRenameFiles(
  body: RenameFilesRequestBody,
  clientId?: string,
): Promise<RenameFilesResponseBody> {
  const config = await buildCoreRoutesConfig(coreRoutesLogger);
  return doRenameFilesCore(
    body,
    {
      ...config,
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
