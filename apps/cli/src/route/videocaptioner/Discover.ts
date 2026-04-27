import type { Hono } from "hono";
import { discoverVideoCaptioner } from "../../utils/VideoCaptioner";
import { logger } from "../../../lib/logger";

export interface VideoCaptionerDiscoverResponseData {
  path?: string;
  error?: string;
}

export async function processVideoCaptionerDiscover(): Promise<VideoCaptionerDiscoverResponseData> {
  try {
    // TODO: Disable for testing, uncomment before commit
    // const path = await discoverVideoCaptioner();
    // if (path) {
    //   return { path };
    // }
    return { error: "videocaptioner not found" };
  } catch (error) {
    logger.error({ error }, "Error discovering videocaptioner");
    return {
      error: `Failed to discover videocaptioner: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function handleVideoCaptionerDiscover(app: Hono) {
  app.get("/api/videocaptioner/discover", async (c) => {
    try {
      const result = await processVideoCaptionerDiscover();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "VideoCaptionerDiscover route error");
      return c.json(
        {
          error: "Failed to process videocaptioner discover request",
        },
        500
      );
    }
  });
}
