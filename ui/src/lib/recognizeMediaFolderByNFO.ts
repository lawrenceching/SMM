import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeMediaFolderByNFO as doTryToRecognizeMediaFolderByNFO } from "@/components/TvShowPanelUtils";
import { listFiles } from "@/api/listFiles";
import { Path } from "@core/path";
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes";

export async function tryToRecognizeMediaFolderByNFO(folderPath: string, signal?: AbortSignal): Promise<RecognizeMediaFolderResult> {

    const resp = await listFiles({ path: folderPath, onlyFiles: true, recursively: true })
    if(resp.error) {
        console.error('[preprocessMediaFolder] failed to list files:', resp.error)
        return { success: false }
    }
    if(resp.data === undefined) {
        console.error('[preprocessMediaFolder] failed to list files:', resp)
        return { success: false }
    }
    const files = resp.data.items.map(item => Path.posix(item.path))

    const mm: UIMediaMetadata = {
        mediaFolderPath: folderPath,
        files: files,
        status: 'idle',
    }
    const mmRecognizedByNFO = await doTryToRecognizeMediaFolderByNFO(mm, signal)
    if(mmRecognizedByNFO !== undefined) {
        return {
            success: true,
            type: mmRecognizedByNFO.type as 'tv' | 'movie' | null,
            tmdbTvShow: mmRecognizedByNFO.tmdbTvShow,
            tmdbMovie: mmRecognizedByNFO.tmdbMovie,
        }
    }

    return {
        success: false,
    }
}
