import { extname, join } from "@/lib/path";
import { findAssociatedFiles } from "@/lib/utils";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import { ext, Path } from "@core/path";
import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@core/types";
import { subtitleFileExtensions } from "@core/utils";
import Debug from "debug";
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
) {

    const { mediaFolderPath, localFiles, plan, traceId } = options;
    const logPrefix = traceId ? `[${traceId}] ` : ''
    debug(`${logPrefix}applyRenameFilesPlanForTvShow CALLED`);

    const renameList: Array<{ from: string; to: string }> = [];
    renameList.push(...plan.files);
    
    for (const file of plan.files) {
        const { from, to } = file;
        
        const newFileRelativePath = to.replace(mediaFolderPath, '');
        const newFileRelativePathWithExt = newFileRelativePath.replace(extname(newFileRelativePath), '');
        
        const associatedFiles = 
            findAssociatedFiles(mediaFolderPath, localFiles, from)
            .map(file => { return file.path })
            .map(relativePath => join(mediaFolderPath, relativePath));

        const renameListForAssoFiles: Array<{ from: string; to: string }> = [];
        for (const associatedFile of associatedFiles) {
            
            let _ext = extname(associatedFile);
            const from = associatedFile;

            // TODO: handle subtitle files with language code
            if(subtitleFileExtensions.includes(_ext)) {
                _ext = ext(associatedFile, 2);
            }

            const to = join(mediaFolderPath, newFileRelativePathWithExt + _ext);

            renameListForAssoFiles.push({ from, to });
        }

        debug(`${logPrefix}rename list for associated files: ${JSON.stringify(renameListForAssoFiles)}`);
        renameList.push(...renameListForAssoFiles);
    }

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

}