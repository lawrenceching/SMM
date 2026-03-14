import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';

export interface UIRecognizeMediaFilePlan extends Omit<RecognizeMediaFilePlan, 'status'> {
    /**
     * UI-only: 'loading' for tmp plan while recognition is in progress.
     */
    status: RecognizeMediaFilePlan['status'] | 'loading';
    /**
     * true if it's a tmp plan created in UI.
     * Tmp plan don't need to persist to disk and can be discarded after use.
     */
    tmp: boolean;
}
