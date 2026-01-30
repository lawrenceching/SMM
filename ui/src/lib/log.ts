import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { isNil } from "es-toolkit";

export function minimize(mm: UIMediaMetadata): any {
    return {
        mediaFolderPath: mm.mediaFolderPath,
        type: mm.type,
        name: mm.tmdbTvShow?.name,
        files: `${isNil(mm.files) ? mm.files : `${mm.files?.length ?? 0} files`}`,
        tmdbTvShow: {
            id: mm.tmdbTvShow?.id,
            name: mm.tmdbTvShow?.name,
        },
        tmdbMovie: {
            id: mm.tmdbMovie?.id,
            title: mm.tmdbMovie?.title,
        },
        status: mm.status,
    }
}