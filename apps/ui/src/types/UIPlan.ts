import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan';
import type { RenameFilesPlan } from '@smm/types/RenameFilesPlan';

/**
 * A plan as consumed by the UI. After the TanStack Query migration the
 * UI no longer keeps `tmp`/`loading` flags — the `preparing` status
 * (from `@smm/types/planCommon`) models the "being computed" phase.
 */
export type UIPlan = RecognizeMediaFilePlan | RenameFilesPlan;
