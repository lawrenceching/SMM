import type { HelloOptions } from '@smm/core-routes';
import { getCore } from '@/core/getCore';
import { resolveCoreRoutesPort } from '@/coreRoutesPort';

/** Static hello options for core-routes fallback (ohos) and legacy callers. */
export function buildHelloOptions(
  reverseProxyUrl: string | null = null,
  coreRoutesPort = resolveCoreRoutesPort(),
): HelloOptions {
  return {
    ...getCore().hello(),
    reverseProxyUrl,
    coreRoutesPort,
  };
}
