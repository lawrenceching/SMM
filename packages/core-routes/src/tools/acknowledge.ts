/**
 * No-op `acknowledge` used by agent tools when the host environment
 * does not provide a Socket.IO connection (e.g. an isolated test, a
 * background job). The default is a 1-second-timeout promise that
 * resolves to `undefined` so the calling tool sees "no reply" — the
 * tool then falls back to a sensible empty default.
 */
export async function defaultAcknowledge(
  _message: unknown,
  _timeoutMs?: number,
): Promise<unknown> {
  return undefined;
}
