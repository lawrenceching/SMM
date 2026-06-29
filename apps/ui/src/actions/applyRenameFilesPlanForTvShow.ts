import { Path } from "@core/path";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@core/types";
import { buildTvShowRenameListForPlan } from "@/lib/buildTvShowRenameListForPlan";

export async function applyRenameFilesPlanForTvShow(
    options: {
        mediaFolderPath: string,
        localFiles: string[],
        plan: UIRenameFilesPlan,
        traceId?: string,
    },
    deps: {
        renameFilesApi: (params: RenameFilesRequestBody) => Promise<RenameFilesResponseBody>,
    }
): Promise<{ renameList: Array<{ from: string; to: string }> }> {

    const { mediaFolderPath, traceId } = options;
    const renameList = buildTvShowRenameListForPlan(options);

    console.log("[rename] calling /renameFiles API", {
        traceId,
        mediaFolderPath,
        renameCount: renameList.length,
    });

    const filesParam = renameList.map(({ from, to }) => { return { from: Path.toPlatformPath(from), to: Path.toPlatformPath(to) } });
    const req: RenameFilesRequestBody = {
        files: filesParam,
        traceId: options.traceId,
        mediaFolder: mediaFolderPath,
        clientId: undefined,
    }

    const resp = await deps.renameFilesApi(req);
    if(resp.error) {
        console.error("[rename] /renameFiles API returned error", { traceId, error: resp.error });
        throw new Error(`/api/renameFiles API error: ${resp.error}`);
    }

    console.log("[rename] /renameFiles API succeeded", { traceId, renamedCount: renameList.length });

    return { renameList };
}
