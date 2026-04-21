import type { Hono } from "hono";
import { z } from "zod/v3";
import { transcribeWithVideoCaptioner } from "../../utils/VideoCaptioner";
import { logger } from "../../../lib/logger";

const transcribeRequestSchema = z.object({
  mediaPath: z.string().min(1, "mediaPath is required"),
});

export type TranscribeRequestBody = z.infer<typeof transcribeRequestSchema>;

export interface VideoCaptionerTranscribeResponseData {
  success?: boolean;
  error?: string;
}

export async function processVideoCaptionerTranscribe(
  body: TranscribeRequestBody
): Promise<VideoCaptionerTranscribeResponseData> {
  try {
    return await transcribeWithVideoCaptioner(body.mediaPath);
  } catch (error) {
    logger.error({ error }, "Error transcribing with videocaptioner");
    return {
      error: `Failed to transcribe media: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function handleVideoCaptionerTranscribe(app: Hono) {
  app.post("/api/videocaptioner/transcribe", async (c) => {
    try {
      const rawBody = await c.req.json();
      const parseResult = transcribeRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? "Invalid request body";
        return c.json({ error: message }, 400);
      }

      const result = await processVideoCaptionerTranscribe(parseResult.data);
      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "VideoCaptionerTranscribe route error");
      return c.json(
        {
          error: "Failed to process videocaptioner transcribe request",
        },
        500
      );
    }
  });
}
