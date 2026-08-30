/**
 * Show the first-run consent dialog only when the user has never answered.
 */
export function shouldShowAnonymousTelemetryConsent(
  consent: boolean | undefined,
): boolean {
  return consent === undefined
}
