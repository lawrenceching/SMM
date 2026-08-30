import type { HelloHttpResponseBody } from '@smm/types'
import { getCore } from '../core/getCore'

export function buildHelloHttpResponse(
  reverseProxyUrl: string | null,
  coreRoutesPort: number,
): HelloHttpResponseBody {
  return { ...getCore().hello(), reverseProxyUrl, coreRoutesPort }
}
