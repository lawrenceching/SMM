import { describe, expect, it } from 'vitest'
import {
  classifyAiConnectionError,
  localizeAiConnectionError,
  type AiConnectionErrorI18nKey,
} from './aiConnectionError'

describe('classifyAiConnectionError', () => {
  it('classifies the AI Settings auth-failure message from providers', () => {
    expect(
      classifyAiConnectionError(
        new Error('Authentication Fails, Your api key: **** is invalid'),
      ),
    ).toBe('authentication')
  })

  it.each([
    ['401 Unauthorized'],
    ['403 Forbidden'],
    ['Invalid API key'],
    ['invalid_api_key'],
    ['Your api key is invalid'],
  ])('classifies %j as authentication', (message) => {
    expect(classifyAiConnectionError(new Error(message))).toBe('authentication')
  })

  it('classifies rate limit errors', () => {
    expect(classifyAiConnectionError(new Error('429 Too Many Requests'))).toBe('rate-limit')
    expect(classifyAiConnectionError(new Error('Rate limit exceeded'))).toBe('rate-limit')
  })

  it('classifies network errors', () => {
    expect(classifyAiConnectionError(new Error('fetch failed'))).toBe('network')
    expect(classifyAiConnectionError(new Error('Failed to fetch'))).toBe('network')
  })

  it('classifies timeout errors', () => {
    expect(classifyAiConnectionError(new Error('Request timed out'))).toBe('timeout')
  })

  it('classifies server errors', () => {
    expect(classifyAiConnectionError(new Error('500 Internal Server Error'))).toBe('server')
  })

  it('classifies local validation errors from checkAiConnection', () => {
    expect(classifyAiConnectionError(new Error('model is required'))).toBe('missing-model')
    expect(classifyAiConnectionError(new Error('apiKey is required'))).toBe('missing-api-key')
    expect(classifyAiConnectionError(new Error('baseURL is required'))).toBe('missing-base-url')
    expect(
      classifyAiConnectionError(
        new Error('Reverse proxy is not available. Please restart the backend.'),
      ),
    ).toBe('reverse-proxy-unavailable')
  })

  it('falls back to unknown for unrecognized messages', () => {
    expect(classifyAiConnectionError(new Error('something weird happened'))).toBe('unknown')
    expect(classifyAiConnectionError('not-an-error')).toBe('unknown')
  })
})

describe('localizeAiConnectionError', () => {
  const translations: Record<AiConnectionErrorI18nKey, string> = {
    'ai.checkErrorAuthentication': '身份验证失败，您的 API 密钥无效。',
    'ai.checkErrorRateLimit': 'AI 提供商请求过于频繁，请稍后再试。',
    'ai.checkErrorNetwork': '网络连接失败，请检查网络与 AI 提供商设置。',
    'ai.checkErrorTimeout': '连接检查超时，请稍后重试。',
    'ai.checkErrorServer': 'AI 提供商服务器错误，请稍后重试。',
    'ai.checkErrorMissingModel': '请填写模型名称。',
    'ai.checkErrorMissingApiKey': '请填写 API 密钥。',
    'ai.checkErrorMissingBaseUrl': '请填写基础 URL。',
    'ai.checkErrorReverseProxyUnavailable': '反向代理不可用，请重启后端服务。',
    'ai.checkError': '连接失败',
  }

  const t = (key: AiConnectionErrorI18nKey) => translations[key]

  it('returns a localized authentication message instead of the raw English SDK text', () => {
    const message = localizeAiConnectionError(
      new Error('Authentication Fails, Your api key: **** is invalid'),
      t,
    )
    expect(message).toBe('身份验证失败，您的 API 密钥无效。')
    expect(message).not.toMatch(/Authentication Fails/i)
  })

  it('returns the generic checkError for unknown errors', () => {
    expect(localizeAiConnectionError(new Error('weird'), t)).toBe('连接失败')
  })
})
