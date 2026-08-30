import type { HelloHttpResponseBody } from '@core/types'
import { getCore } from '../core/getCore'

export function buildHelloHttpResponse(
  reverseProxyUrl: string | null,
  coreRoutesPort: number,
): HelloHttpResponseBody {
  return { ...getCore().hello(), reverseProxyUrl, coreRoutesPort }
}
