/**
 * Classify and localize errors from AI Settings "Check" (checkAiConnection).
 *
 * Providers/AI SDK return English messages (e.g. "Authentication Fails,
 * Your api key: **** is invalid"). The UI must never surface those raw
 * strings when a UI language other than English is selected.
 */

export type AiConnectionErrorType =
  | 'authentication'
  | 'rate-limit'
  | 'network'
  | 'timeout'
  | 'server'
  | 'missing-model'
  | 'missing-api-key'
  | 'missing-base-url'
  | 'reverse-proxy-unavailable'
  | 'unknown'

export type AiConnectionErrorI18nKey =
  | 'ai.checkErrorAuthentication'
  | 'ai.checkErrorRateLimit'
  | 'ai.checkErrorNetwork'
  | 'ai.checkErrorTimeout'
  | 'ai.checkErrorServer'
  | 'ai.checkErrorMissingModel'
  | 'ai.checkErrorMissingApiKey'
  | 'ai.checkErrorMissingBaseUrl'
  | 'ai.checkErrorReverseProxyUnavailable'
  | 'ai.checkError'

const I18N_KEYS = {
  authentication: 'ai.checkErrorAuthentication',
  'rate-limit': 'ai.checkErrorRateLimit',
  network: 'ai.checkErrorNetwork',
  timeout: 'ai.checkErrorTimeout',
  server: 'ai.checkErrorServer',
  'missing-model': 'ai.checkErrorMissingModel',
  'missing-api-key': 'ai.checkErrorMissingApiKey',
  'missing-base-url': 'ai.checkErrorMissingBaseUrl',
  'reverse-proxy-unavailable': 'ai.checkErrorReverseProxyUnavailable',
  unknown: 'ai.checkError',
} as const satisfies Record<AiConnectionErrorType, AiConnectionErrorI18nKey>

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function classifyAiConnectionError(error: unknown): AiConnectionErrorType {
  const message = errorMessage(error)
  const lower = message.toLowerCase()

  if (message === 'model is required') return 'missing-model'
  if (message === 'apiKey is required') return 'missing-api-key'
  if (message === 'baseURL is required') return 'missing-base-url'
  if (lower.includes('reverse proxy is not available')) return 'reverse-proxy-unavailable'

  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key') ||
    /api\s*key.*invalid/i.test(message) ||
    /invalid.*api\s*key/i.test(message)
  ) {
    return 'authentication'
  }

  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'rate-limit'
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused') ||
    (lower.includes('network') && !lower.includes('internal'))
  ) {
    return 'network'
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted')
  ) {
    return 'timeout'
  }

  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('internal server error') ||
    lower.includes('service unavailable')
  ) {
    return 'server'
  }

  return 'unknown'
}

export function localizeAiConnectionError(
  error: unknown,
  t: (key: AiConnectionErrorI18nKey) => string,
): string {
  const type = classifyAiConnectionError(error)
  return t(I18N_KEYS[type])
}
