import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';

/**
 * @deprecated Use {@link RecognizeMediaFilePlan} directly. The UI no
 * longer adds `tmp`/`loading`; the `preparing` status models the
 * "being computed" phase. Kept as an alias to avoid churn.
 */
export type UIRecognizeMediaFilePlan = RecognizeMediaFilePlan;
