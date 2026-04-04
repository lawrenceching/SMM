import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { isNil } from "es-toolkit";

export function minimize(mm: UIMediaMetadata): any {
    return {
        mediaFolderPath: mm.mediaFolderPath,
        type: mm.type,
        name: mm.tvShow?.name,
        files: `${isNil(mm.files) ? mm.files : `${mm.files?.length ?? 0} files`}`,
        tvShow: {
            id: mm.tvShow?.id,
            name: mm.tvShow?.name,
        },
        movie: {
            id: mm.movie?.id,
            name: mm.movie?.name,
        },
        status: mm.status,
    }
}