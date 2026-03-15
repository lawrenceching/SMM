import type { RenameFilesPlan } from '@core/types/RenameFilesPlan';

export interface UIRenameFilesPlan extends Omit<RenameFilesPlan, 'status'> {
    /**
     * UI-only: 'loading' for tmp plan while renaming is in progress.
     */
    status: RenameFilesPlan['status'] | 'loading';
    /**
     * true if it's a tmp plan created in UI.
     * Tmp plan don't need to persist to disk and can be discarded after use.
     */
    tmp: boolean;
}
