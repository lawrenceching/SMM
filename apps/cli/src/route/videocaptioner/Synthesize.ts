import type { Hono } from "hono";
import { z } from "zod/v3";
import {
  synthesizeWithVideoCaptioner,
  VIDEOCAPTIONER_SUBTITLE_LAYOUTS,
  VIDEOCAPTIONER_SYNTHESIZE_QUALITY,
  VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES,
  VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES,
} from "../../utils/VideoCaptioner";
import { logger } from "../../../lib/logger";

const synthesizeRequestSchema = z.object({
  videoPath: z.string().min(1, "videoPath is required"),
  subtitlePath: z.string().min(1, "subtitlePath is required"),
  subtitleMode: z.enum(VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES).optional(),
  quality: z.enum(VIDEOCAPTIONER_SYNTHESIZE_QUALITY).optional(),
  style: z.string().optional(),
  renderMode: z.enum(VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES).optional(),
  layout: z.enum(VIDEOCAPTIONER_SUBTITLE_LAYOUTS).optional(),
});

export type SynthesizeRequestBody = z.infer<typeof synthesizeRequestSchema>;

export interface VideoCaptionerSynthesizeResponseData {
  success?: boolean;
  error?: string;
}

export async function processVideoCaptionerSynthesize(
  body: SynthesizeRequestBody
): Promise<VideoCaptionerSynthesizeResponseData> {
  try {
    const cliOpts = {
      ...(body.subtitleMode !== undefined ? { subtitleMode: body.subtitleMode } : {}),
      ...(body.quality !== undefined ? { quality: body.quality } : {}),
      ...(body.style !== undefined && body.style.trim() !== "" ? { style: body.style } : {}),
      ...(body.renderMode !== undefined ? { renderMode: body.renderMode } : {}),
      ...(body.layout !== undefined ? { layout: body.layout } : {}),
    };
    return await synthesizeWithVideoCaptioner(body.videoPath, body.subtitlePath, cliOpts);
  } catch (error) {
    logger.error({ error }, "Error synthesizing subtitle with videocaptioner");
    return {
      error: `Failed to synthesize subtitle: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function handleVideoCaptionerSynthesize(app: Hono) {
  app.post("/api/videocaptioner/synthesize", async (c) => {
    logger.info(
      { path: c.req.path, contentType: c.req.header("content-type") },
      "videocaptioner synthesize: request received",
    );
    try {
      const rawBody = await c.req.json();
      const parseResult = synthesizeRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? "Invalid request body";
        return c.json({ error: message }, 400);
      }

      const result = await processVideoCaptionerSynthesize(parseResult.data);
      if (result.error) {
        logger.warn(
          {
            error: result.error,
            videoPath: parseResult.data.videoPath,
            subtitlePath: parseResult.data.subtitlePath,
            subtitleMode: parseResult.data.subtitleMode,
            quality: parseResult.data.quality,
          },
          "videocaptioner synthesize: process failed (HTTP 400)",
        );
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "VideoCaptionerSynthesize route error");
      return c.json(
        {
          error: "Failed to process videocaptioner synthesize request",
        },
        500
      );
    }
  });
}
