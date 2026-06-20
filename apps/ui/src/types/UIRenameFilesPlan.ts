import type { RenameFilesPlan } from '@core/types/RenameFilesPlan';

/**
 * @deprecated Use {@link RenameFilesPlan} directly. The UI no longer
 * adds `tmp`/`loading`; the `preparing` status models the "being
 * computed" phase. Kept as an alias to avoid churn.
 */
export type UIRenameFilesPlan = RenameFilesPlan;
