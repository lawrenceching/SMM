import type { Hono } from "hono";
import { z } from "zod/v3";
import {
  transcribeWithVideoCaptioner,
  VIDEOCAPTIONER_ASR_ENGINES,
  VIDEOCAPTIONER_TRANSCRIBE_FORMATS,
} from "../../utils/VideoCaptioner";
import { parseOptionalXCommandExecutionId } from "../commandLog";
import { logger } from "../../../lib/logger";

const transcribeRequestSchema = z.object({
  mediaPath: z.string().min(1, "mediaPath is required"),
  asr: z.enum(VIDEOCAPTIONER_ASR_ENGINES).optional(),
  language: z.string().min(1).optional(),
  wordTimestamps: z.boolean().optional(),
  format: z.enum(VIDEOCAPTIONER_TRANSCRIBE_FORMATS).optional(),
});

export type TranscribeRequestBody = z.infer<typeof transcribeRequestSchema>;

export interface VideoCaptionerTranscribeResponseData {
  success?: boolean;
  error?: string;
  executionId?: string;
  logRelativePath?: string;
}

export async function processVideoCaptionerTranscribe(
  body: TranscribeRequestBody,
  clientExecutionId?: string,
): Promise<VideoCaptionerTranscribeResponseData> {
  try {
    const cliOpts =
      body.asr !== undefined ||
      body.language !== undefined ||
      body.wordTimestamps !== undefined ||
      body.format !== undefined
        ? {
            ...(body.asr !== undefined ? { asr: body.asr } : {}),
            ...(body.language !== undefined ? { language: body.language } : {}),
            ...(body.wordTimestamps !== undefined ? { wordTimestamps: body.wordTimestamps } : {}),
            ...(body.format !== undefined ? { format: body.format } : {}),
          }
        : undefined;
    if (clientExecutionId !== undefined) {
      return await transcribeWithVideoCaptioner(body.mediaPath, cliOpts, clientExecutionId);
    }
    return await transcribeWithVideoCaptioner(body.mediaPath, cliOpts);
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

      const { id: clientExecutionId, error: headerError } = parseOptionalXCommandExecutionId(
        c.req.header("X-Command-Execution-Id"),
      );
      if (headerError) {
        return c.json({ error: headerError }, 400);
      }

      const result = await processVideoCaptionerTranscribe(parseResult.data, clientExecutionId);
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
