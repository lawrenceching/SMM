import { z } from "zod/v3";
import type {
  RecognizeMediaFilePlan,
} from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import { defaultChatFs } from "./chatFs.ts";
import type { ChatFs } from "./chatTypes.ts";
import type { CoreRoutesConfig } from "./types.ts";
import { resolveAppDataDir } from "./userConfig.ts";
import {
  createPlan,
  getActivePlansForFolder,
  updatePlanContent,
  type AnyPlan,
} from "./tools/plans.ts";

export interface GetPlansResponseBody {
  data?: { plans: AnyPlan[] };
  error?: string;
}

export interface CreatePlanResponseBody {
  data?: { plan: AnyPlan };
  error?: string;
}

export interface UpdatePlanResponseBody {
  data?: { plan: AnyPlan };
  error?: string;
}

const getPlansRequestSchema = z.object({
  mediaFolderPath: z.string().min(1, "mediaFolderPath is required"),
});

const createPlanRequestSchema = z.object({
  id: z.string().optional(),
  task: z.enum(["recognize-media-file", "rename-files"]),
  mediaFolderPath: z.string().min(1, "mediaFolderPath is required"),
  creator: z.enum(["app", "ai"]),
});

const recognizedFileSchema = z.object({
  season: z.number(),
  episode: z.number(),
  path: z.string(),
});

const renameEntrySchema = z.object({
  from: z.string(),
  to: z.string(),
});

const updatePlanRequestSchema = z.object({
  id: z.string().min(1, "id is required"),
  status: z
    .enum(["preparing", "pending", "completed", "rejected"])
    .optional(),
  files: z
    .union([z.array(recognizedFileSchema), z.array(renameEntrySchema)])
    .optional(),
});

function resolveFs(config: CoreRoutesConfig): ChatFs {
  return config.chat?.fs ?? defaultChatFs();
}

function validationError(error: z.ZodError): string {
  return `Error Reason: Invalid request body: ${error.issues
    .map((i) => i.message)
    .join(", ")}`;
}

export async function doGetPlans(
  body: unknown,
  config: CoreRoutesConfig = { allowlist: [] },
): Promise<GetPlansResponseBody> {
  const parsed = getPlansRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { error: validationError(parsed.error) };
  }

  const appDataDir = resolveAppDataDir(config);
  if (!appDataDir) {
    return { error: "Error Reason: appDataDir is not configured" };
  }

  const plans = await getActivePlansForFolder(
    appDataDir,
    parsed.data.mediaFolderPath,
    resolveFs(config),
  );
  return { data: { plans } };
}

export async function doCreatePlan(
  body: unknown,
  config: CoreRoutesConfig = { allowlist: [] },
): Promise<CreatePlanResponseBody> {
  const parsed = createPlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { error: validationError(parsed.error) };
  }

  const appDataDir = resolveAppDataDir(config);
  if (!appDataDir) {
    return { error: "Error Reason: appDataDir is not configured" };
  }

  const plan = await createPlan(appDataDir, parsed.data, resolveFs(config));
  return { data: { plan } };
}

export async function doUpdatePlan(
  body: unknown,
  config: CoreRoutesConfig = { allowlist: [] },
): Promise<UpdatePlanResponseBody> {
  const parsed = updatePlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { error: validationError(parsed.error) };
  }

  const appDataDir = resolveAppDataDir(config);
  if (!appDataDir) {
    return { error: "Error Reason: appDataDir is not configured" };
  }

  const { id, status, files } = parsed.data;
  const plan = await updatePlanContent(
    appDataDir,
    id,
    {
      status,
      files: files as
        | RecognizeMediaFilePlan["files"]
        | RenameFilesPlan["files"]
        | undefined,
    },
    resolveFs(config),
  );

  if (!plan) {
    return { error: `Error Reason: Plan with id "${id}" not found` };
  }

  return { data: { plan } };
}
