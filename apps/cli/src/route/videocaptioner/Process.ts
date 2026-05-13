import type { Hono } from "hono";
import { z } from "zod/v3";
import fs from "fs";
import {
  buildProcessVideoCaptionerArgs,
  PROCESS_TIMEOUT_MS,
  resolveSpawnEnvForVideoCaptioner,
  VIDEOCAPTIONER_ASR_ENGINES,
  VIDEOCAPTIONER_SUBTITLE_LAYOUTS,
  VIDEOCAPTIONER_SYNTHESIZE_QUALITY,
  VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES,
  VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES,
  VIDEOCAPTIONER_TRANSCRIBE_FORMATS,
  VIDEOCAPTIONER_TRANSLATORS,
} from "../../utils/VideoCaptioner";
import { runWhitelistedCommandSync } from "../executeCmd";
import { logger } from "../../../lib/logger";

const processRequestSchema = z
  .object({
    mediaPath: z.string().min(1, "mediaPath is required"),
    asr: z.enum(VIDEOCAPTIONER_ASR_ENGINES).optional(),
    language: z.string().min(1).optional(),
    wordTimestamps: z.boolean().optional(),
    format: z.enum(VIDEOCAPTIONER_TRANSCRIBE_FORMATS).optional(),
    noOptimize: z.boolean().optional(),
    noTranslate: z.boolean().optional(),
    noSplit: z.boolean().optional(),
    translator: z.enum(VIDEOCAPTIONER_TRANSLATORS).optional(),
    targetLanguage: z.string().min(1).optional(),
    reflect: z.boolean().optional(),
    layout: z.enum(VIDEOCAPTIONER_SUBTITLE_LAYOUTS).optional(),
    prompt: z.string().optional(),
    llm: z
      .object({
        apiKey: z.string().min(1),
        apiBase: z.string().optional(),
        model: z.string().optional(),
      })
      .optional(),
    noSynthesize: z.boolean().optional(),
    subtitleMode: z.enum(VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES).optional(),
    quality: z.enum(VIDEOCAPTIONER_SYNTHESIZE_QUALITY).optional(),
    style: z.string().optional(),
    renderMode: z.enum(VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES).optional(),
    synthesizeLayout: z.enum(VIDEOCAPTIONER_SUBTITLE_LAYOUTS).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.noTranslate !== true) {
      if (data.translator === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "translator is required unless noTranslate is true",
          path: ["translator"],
        });
      }
      if (!data.targetLanguage?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "targetLanguage is required unless noTranslate is true",
          path: ["targetLanguage"],
        });
      }
    }
    if (data.noTranslate !== true && data.translator === "llm") {
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

export type ProcessRequestBody = z.infer<typeof processRequestSchema>;

export interface VideoCaptionerProcessResponseData {
  success?: boolean;
  error?: string;
}

function bodyToCliOptions(body: ProcessRequestBody) {
  const transcribe =
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

  const synthesize =
    body.noSynthesize === true
      ? undefined
      : body.subtitleMode !== undefined ||
          body.quality !== undefined ||
          (body.style !== undefined && body.style.trim() !== "") ||
          body.renderMode !== undefined ||
          body.synthesizeLayout !== undefined
        ? {
            ...(body.subtitleMode !== undefined ? { subtitleMode: body.subtitleMode } : {}),
            ...(body.quality !== undefined ? { quality: body.quality } : {}),
            ...(body.style !== undefined && body.style.trim() !== "" ? { style: body.style.trim() } : {}),
            ...(body.renderMode !== undefined ? { renderMode: body.renderMode } : {}),
            ...(body.synthesizeLayout !== undefined ? { layout: body.synthesizeLayout } : {}),
          }
        : undefined;

  return {
    ...(transcribe !== undefined ? { transcribe } : {}),
    ...(body.noOptimize === true ? { noOptimize: true as const } : {}),
    ...(body.noSplit === true ? { noSplit: true as const } : {}),
    ...(body.noTranslate === true ? { noTranslate: true as const } : {}),
    ...(body.noTranslate !== true && body.translator !== undefined
      ? {
          translator: body.translator,
          targetLanguage: body.targetLanguage!.trim(),
          ...(body.reflect === true ? { reflect: true as const } : {}),
          ...(body.layout !== undefined ? { layout: body.layout } : {}),
          ...(body.prompt?.trim() ? { prompt: body.prompt.trim() } : {}),
          ...(body.translator === "llm" && body.llm
            ? {
                llm: {
                  apiKey: body.llm.apiKey.trim(),
                  ...(body.llm.apiBase?.trim() ? { apiBase: body.llm.apiBase.trim() } : {}),
                  ...(body.llm.model?.trim() ? { model: body.llm.model.trim() } : {}),
                },
              }
            : {}),
        }
      : {}),
    ...(body.noSynthesize === true ? { noSynthesize: true as const } : {}),
    ...(synthesize !== undefined && Object.keys(synthesize).length > 0 ? { synthesize } : {}),
  };
}

export async function processVideoCaptionerProcess(
  body: ProcessRequestBody
): Promise<VideoCaptionerProcessResponseData> {
  try {
    if (!fs.existsSync(body.mediaPath)) {
      return { error: `file not found: ${body.mediaPath}` };
    }
    const cliOpts = bodyToCliOptions(body);
    const env = await resolveSpawnEnvForVideoCaptioner();
    return await runWhitelistedCommandSync({
      command: "videocaptioner",
      args: buildProcessVideoCaptionerArgs(body.mediaPath, cliOpts),
      timeoutMs: PROCESS_TIMEOUT_MS,
      ...(env ? { env } : {}),
      logMeta: { mediaPath: body.mediaPath, route: "/api/videocaptioner/process" },
    });
  } catch (error) {
    logger.error({ error }, "Error running videocaptioner process");
    return {
      error: `Failed to run videocaptioner process: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function handleVideoCaptionerProcess(app: Hono) {
  app.post("/api/videocaptioner/process", async (c) => {
    logger.info(
      { path: c.req.path, contentType: c.req.header("content-type") },
      "videocaptioner process: request received",
    );
    try {
      const rawBody = await c.req.json();
      const parseResult = processRequestSchema.safeParse(rawBody);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? "Invalid request body";
        return c.json({ error: message }, 400);
      }

      const result = await processVideoCaptionerProcess(parseResult.data);
      if (result.error) {
        logger.warn(
          {
            error: result.error,
            mediaPath: parseResult.data.mediaPath,
          },
          "videocaptioner process: failed (HTTP 400)",
        );
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "VideoCaptionerProcess route error");
      return c.json(
        {
          error: "Failed to process videocaptioner process request",
        },
        500,
      );
    }
  });
}
