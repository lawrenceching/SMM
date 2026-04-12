import { Path } from "@core/path";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@core/types";
import Debug from "debug";
import { buildTvShowRenameListForPlan } from "@/lib/buildTvShowRenameListForPlan";

const debug = Debug("applyRenameFilesPlanForTvShow");

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
    const logPrefix = traceId ? `[${traceId}] ` : ''
    debug(`${logPrefix}applyRenameFilesPlanForTvShow CALLED`);

    const renameList = buildTvShowRenameListForPlan(options);

    const filesParam = renameList.map(({ from, to }) => { return { from: Path.toPlatformPath(from), to: Path.toPlatformPath(to) } });
    const req: RenameFilesRequestBody = {
        files: filesParam,
        traceId: options.traceId,
        mediaFolder: mediaFolderPath,
        clientId: undefined,
    }

    debug(`${logPrefix}applyRenameFilesPlanForTvShow REQUEST: ${JSON.stringify(req)}`);
    const resp = await deps.renameFilesApi(req);
    debug(`${logPrefix}applyRenameFilesPlanForTvShow RESPONSE: ${JSON.stringify(resp)}`);
    if(resp.error) {
        debug(`${logPrefix}applyRenameFilesPlanForTvShow ERROR: ${resp.error}`);
        throw new Error(`/api/renameFiles API error: ${resp.error}`);
    }

    debug(`${logPrefix}applyRenameFilesPlanForTvShow SUCCESS`);

    return { renameList };
}
