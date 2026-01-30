import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeMediaFolderByNFO as doTryToRecognizeMediaFolderByNFO } from "@/components/TvShowPanelUtils";

export async function tryToRecognizeMediaFolderByNFO(_in_mm: UIMediaMetadata, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {
    return await doTryToRecognizeMediaFolderByNFO(_in_mm, signal)
}
