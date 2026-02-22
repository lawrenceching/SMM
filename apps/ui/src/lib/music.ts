import type { MusicFileProps, MusicMediaMetadata } from "@/types/MusicMediaMetadata";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";
import { extensions } from "@core/utils";

export function newMusicMediaMetadata(mm: UIMediaMetadata): MusicMediaMetadata {
    return {
        ...mm,
        musicFiles: buildMusicFilePropsArray(mm.files ?? []),
    }
}

export function buildMusicFilePropsArray(files: string[]): MusicFileProps[] {
    const propsArray: MusicFileProps[] = [];
    const videoFiles = findFilesByExtensions(files, extensions.videoFileExtensions);
    const audioFiles = findFilesByExtensions(files, extensions.musicFileExtensions);
    propsArray.push(...videoFiles.map(file => buildMusicFileProps(files, file, "video")));
    propsArray.push(...audioFiles.map(file => buildMusicFileProps(files, file, "audio")));

    return propsArray;
}

export function buildMusicFileProps(files: string[], file: string, type: "audio" | "video"): MusicFileProps {

    const filename = new Path(file).name()
    const filenameWithoutExt = filename.lastIndexOf('.') !== -1 ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    const associatedFiles = findFilesByFileName(files, filenameWithoutExt);

    return {
        type: type,
        path: file,
        filename: filename,
        title: undefined,
        author: undefined,
        /**
         * URI
         * could be `file:///path/to/thumbnail.jpg` or `https://example.com/thumbnail.jpg`
         */
        thumbnailUri: `file://` + findThumbnail(associatedFiles),
        duration: undefined,
    }
}

/**
 * 
 * @param associatedFiles Absolute path for associated files 
 */
export function findThumbnail(associatedFiles: string[]): string | undefined {
    const imageExts = extensions.imageFileExtensions;
    const ret = findFilesByExtensions(associatedFiles, imageExts);
    return ret[0]
}

/**
 * 
 * @param files 
 * @param extensions The extensions with the dot prefix, for example, ['.jpg', '.jpeg', '.png']
 * @returns 
 */
export function findFilesByExtensions(files: string[], extensions: string[]): string[] {
    const extSet = new Set(extensions);
    return files.filter(file => {
        const filename = new Path(file).name();
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) return false;
        const extension = filename.substring(lastDotIndex);
        return extSet.has(extension);
    });
}

/**
 * 
 * @param files file paths in POSIX format
 * @param filenameWithoutExt 
 */
export function findFilesByFileName(files: string[], filenameWithoutExt: string): string[] {
    return files.filter(file => {
        const filename = new Path(file).name();
        const lastDotIndex = filename.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
        return nameWithoutExt === filenameWithoutExt;
    });
}

