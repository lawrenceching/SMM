import { Hono } from "hono";
import { z } from "zod/v3";
import { transcribeWithTencentAsrHttp } from "../../utils/TencentAsr";
import { logger } from "../../../lib/logger";

const tencentTranscribeRequestSchema = z.object({
  mediaPath: z.string().min(1, "mediaPath is required"),
  baseUrl: z.string().min(1, "baseUrl is required"),
  apiKey: z.string().min(1, "apiKey is required"),
});

export type TencentAsrTranscribeRequestBody = z.infer<typeof tencentTranscribeRequestSchema>;

export interface TencentAsrTranscribeResponseData {
  success?: boolean;
  error?: string;
}

export async function processTencentAsrTranscribe(
  body: TencentAsrTranscribeRequestBody
): Promise<TencentAsrTranscribeResponseData> {
  try {
    return await transcribeWithTencentAsrHttp({
      mediaPath: body.mediaPath.trim(),
      baseUrl: body.baseUrl.trim(),
      apiKey: body.apiKey.trim(),
    });
  } catch (error) {
    logger.error({ error }, "Error transcribing with Tencent ASR");
    return {
      error: `Failed to transcribe media: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export const tencentAsrTranscribeRoute = new Hono().post("/api/tencent-asr/transcribe", async (c) => {
  try {
    const rawBody = await c.req.json();
    const parseResult = tencentTranscribeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const message = firstIssue?.message ?? "Invalid request body";
      return c.json<{ error: string }>({ error: message }, 400);
    }

    const result = await processTencentAsrTranscribe(parseResult.data);
    if (result.error) {
      return c.json<TencentAsrTranscribeResponseData>(result, 400);
    }
    return c.json<TencentAsrTranscribeResponseData>(result, 200);
  } catch (error) {
    logger.error({ error }, "Tencent ASR transcribe route error");
    return c.json<{ error: string }>(
      {
        error: "Failed to process Tencent ASR transcribe request",
      },
      500
    );
  }
});
