import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';

export interface UIRecognizeMediaFilePlan extends RecognizeMediaFilePlan {
    /**
     * true if it's a tmp plan created in UI.
     * Tmp plan don't need to persist to disk and can be discarded after use.
     */
    tmp: boolean;
}
