import { z } from "zod/v3";
import {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from "@smm/core/ai-tool/buildListFilesInMediaFolderResponse";
import { formatToolError, requireNonEmptyString, toolOk } from "@smm/core/ai-tool/toolResult";
import {
  LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH,
  LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED,
  type ListFilesInMediaFolderToolOutput,
} from "@smm/core/types/ai-tools/listFilesInMediaFolder";
import { doListFiles } from "./listFiles.ts";
import type { CoreRoutesConfig } from "./types.ts";
import { isMediaFolderManaged } from "./userConfig.ts";

const listFilesInMediaFolderRequestSchema = z.object({
  mediaFolderPath: z
    .string()
    .min(1, "The absolute path of the media folder is required"),
  recursively: z.boolean().optional(),
  videoFileOnly: z.boolean().optional(),
});

export type ListFilesInMediaFolderRequestBody = z.infer<
  typeof listFilesInMediaFolderRequestSchema
>;

export async function doListFilesInMediaFolder(
  body: unknown,
  config: CoreRoutesConfig = {},
): Promise<ListFilesInMediaFolderToolOutput> {
  const parsed = listFilesInMediaFolderRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return {
      ...createEmptyListFilesInMediaFolderData(),
      error: `Validation Failed: ${msg}`,
    };
  }

  const pathCheck = requireNonEmptyString(
    parsed.data.mediaFolderPath,
    "mediaFolderPath",
  );
  if (typeof pathCheck !== "string") {
    return {
      ...createEmptyListFilesInMediaFolderData(),
      error: LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH,
    };
  }

  const empty = createEmptyListFilesInMediaFolderData();

  if (!(await isMediaFolderManaged(pathCheck, config))) {
    return { ...empty, error: LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED };
  }

  try {
    const listResult = await doListFiles(
      {
        path: pathCheck,
        recursively: parsed.data.recursively ?? true,
        onlyFiles: true,
      },
      config,
    );

    if (listResult.error) {
      return { ...empty, error: listResult.error };
    }

    const filePaths =
      listResult.data?.items
        .filter((item) => !item.isDirectory)
        .map((item) => item.path) ?? [];

    return toolOk(
      buildListFilesInMediaFolderResponse(
        filePaths,
        parsed.data.videoFileOnly ?? false,
      ),
    );
  } catch (error) {
    return {
      ...empty,
      ...formatToolError(error),
    };
  }
}
