import type { Hono } from "hono";
import { z } from "zod/v3";
import {
  translateSubtitleWithVideoCaptioner,
  VIDEOCAPTIONER_SUBTITLE_LAYOUTS,
  VIDEOCAPTIONER_TRANSLATORS,
} from "../../utils/VideoCaptioner";
import { parseOptionalXCommandExecutionId } from "../commandLog";
import { logger } from "../../../lib/logger";

const translateRequestSchema = z
  .object({
    subtitlePath: z.string().min(1, "subtitlePath is required"),
    translator: z.enum(VIDEOCAPTIONER_TRANSLATORS),
    targetLanguage: z.string().min(1, "targetLanguage is required"),
    reflect: z.boolean().optional(),
    layout: z.enum(VIDEOCAPTIONER_SUBTITLE_LAYOUTS).optional(),
    llm: z
      .object({
        apiKey: z.string().min(1),
        apiBase: z.string().optional(),
        model: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.translator === "llm") {
      const key = data.llm?.apiKey?.trim();
      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "llm.apiKey is required when translator is llm",
          path: ["llm", "apiKey"],
        });
      }
    }
  });

export type TranslateRequestBody = z.infer<typeof translateRequestSchema>;

export interface VideoCaptionerTranslateResponseData {
  success?: boolean;
  error?: string;
  executionId?: string;
  logRelativePath?: string;
}

export async function processVideoCaptionerTranslate(
  body: TranslateRequestBody,
  clientExecutionId?: string,
): Promise<VideoCaptionerTranslateResponseData> {
  try {
    const cliOpts = {
      translator: body.translator,
      targetLanguage: body.targetLanguage,
      ...(body.reflect === true ? { reflect: true as const } : {}),
      ...(body.layout !== undefined ? { layout: body.layout } : {}),
      ...(body.translator === "llm" && body.llm
        ? {
            llm: {
              apiKey: body.llm.apiKey.trim(),
              ...(body.llm.apiBase?.trim() ? { apiBase: body.llm.apiBase.trim() } : {}),
              ...(body.llm.model?.trim() ? { model: body.llm.model.trim() } : {}),
            },
          }
        : {}),
    };
    if (clientExecutionId !== undefined) {
      return await translateSubtitleWithVideoCaptioner(body.subtitlePath, cliOpts, clientExecutionId);
    }
    return await translateSubtitleWithVideoCaptioner(body.subtitlePath, cliOpts);
  } catch (error) {
    logger.error({ error }, "Error translating subtitle with videocaptioner");
    return {
      error: `Failed to translate subtitle: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function handleVideoCaptionerTranslate(app: Hono) {
  app.post("/api/videocaptioner/translate", async (c) => {
    try {
      const rawBody = await c.req.json();
      const parseResult = translateRequestSchema.safeParse(rawBody);
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

      const result = await processVideoCaptionerTranslate(parseResult.data, clientExecutionId);
      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "VideoCaptionerTranslate route error");
      return c.json(
        {
          error: "Failed to process videocaptioner translate request",
        },
        500
      );
    }
  });
}
