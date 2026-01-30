import type { MediaMetadata } from "@core/types";

export interface UIMediaMetadata extends MediaMetadata {
    status: 'idle' | 'initializing' | 'ok' | 'folder_not_found',
}