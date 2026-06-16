import { z } from "zod/v3";
import {
  buildGetEpisodesResponse,
  createEmptyGetEpisodesData,
} from "@smm/core/ai-tool/buildGetEpisodesResponse";
import { requireNonEmptyString, toolOk } from "@smm/core/ai-tool/toolResult";
import {
  GET_EPISODES_INVALID_PATH,
  GET_EPISODES_NO_CACHE,
  GET_EPISODES_NOT_MANAGED,
  GET_EPISODES_NOT_TV_SHOW,
  type GetEpisodesToolOutput,
} from "@smm/core/types/ai-tools/getEpisodes";
import { readMediaMetadataCache } from "./mediaMetadataCache.ts";
import type { CoreRoutesConfig } from "./types.ts";
import { isMediaFolderManaged, resolveAppDataDir } from "./userConfig.ts";

const getEpisodesRequestSchema = z.object({
  mediaFolderPath: z
    .string()
    .min(1, "The absolute path of the media folder is required"),
});

export type GetEpisodesRequestBody = z.infer<typeof getEpisodesRequestSchema>;

export async function doGetEpisodes(
  body: unknown,
  config: CoreRoutesConfig = {},
): Promise<GetEpisodesToolOutput> {
  const parsed = getEpisodesRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return {
      ...createEmptyGetEpisodesData(),
      error: `Validation Failed: ${msg}`,
    };
  }

  const pathCheck = requireNonEmptyString(
    parsed.data.mediaFolderPath,
    "mediaFolderPath",
  );
  if (typeof pathCheck !== "string") {
    return { ...createEmptyGetEpisodesData(), error: GET_EPISODES_INVALID_PATH };
  }

  const empty = createEmptyGetEpisodesData();

  if (!(await isMediaFolderManaged(pathCheck, config))) {
    return { ...empty, error: GET_EPISODES_NOT_MANAGED };
  }

  const appDataDir = resolveAppDataDir(config);
  if (!appDataDir) {
    return { ...empty, error: GET_EPISODES_NO_CACHE };
  }

  const metadata = await readMediaMetadataCache(appDataDir, pathCheck);
  if (!metadata) {
    return { ...empty, error: GET_EPISODES_NO_CACHE };
  }

  if (!metadata.tvShow) {
    return { ...empty, error: GET_EPISODES_NOT_TV_SHOW };
  }

  config.logger?.info(
    {
      mediaFolderPath: pathCheck,
      seasonCount: metadata.tvShow.seasons?.length ?? 0,
      mediaFileCount: metadata.mediaFiles?.length ?? 0,
    },
    "[getEpisodes] building episode list",
  );

  return toolOk(buildGetEpisodesResponse(metadata));
}
