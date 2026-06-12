import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the AI SDK modules so we never hit the network.
// `vi.hoisted` is needed because vi.mock factory closures are hoisted
// above the top-level `vi.fn()` declarations otherwise.
const { generateTextMock, createOpenAICompatibleMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  createOpenAICompatibleMock: vi.fn(),
}))

vi.mock('ai', () => ({
  generateText: generateTextMock,
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

import { checkAiConnection } from './checkAiConnection'

interface CapturedProviderConfig {
  baseURL: string
  apiKey: string
  headers: Record<string, string>
}

interface CapturedChatModelArgs {
  modelId: string
}

const REVERSE_PROXY_URL = 'http://127.0.0.1:30005'
const REAL_BASE_URL = 'https://api.deepseek.com/v1'

function buildFakeProvider() {
  const captured: { config?: CapturedProviderConfig; chatArgs?: CapturedChatModelArgs } = {}
  const chatModelFn = vi.fn((modelId: string) => {
    captured.chatArgs = { modelId }
    return { modelId }
  })
  const provider = {
    chatModel: chatModelFn,
  }
  createOpenAICompatibleMock.mockImplementation((config: CapturedProviderConfig) => {
    captured.config = config
    return provider
  })
  return { provider, chatModelFn, captured }
}

beforeEach(() => {
  generateTextMock.mockReset()
  createOpenAICompatibleMock.mockReset()
  // Default success: generateText resolves with a text payload.
  generateTextMock.mockResolvedValue({ text: 'hello back' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkAiConnection (reverse-proxy path)', () => {
  it('returns { status: "ok", model } on a successful ping', async () => {
    const { captured } = buildFakeProvider()

    const result = await checkAiConnection({
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      baseURL: REAL_BASE_URL,
      reverseProxyUrl: REVERSE_PROXY_URL,
    })

    expect(result).toEqual({ status: 'ok', model: 'deepseek-chat' })
    expect(captured.config).toEqual({
      name: 'ai-check',
      baseURL: REVERSE_PROXY_URL,
      apiKey: 'sk-test',
      headers: { 'X-SMM-Proxy-Upstream-BaseURL': REAL_BASE_URL },
    })
  })

  it('routes the generateText call through provider.chatModel(model) with prompt "hello"', async () => {
    const { chatModelFn } = buildFakeProvider()

    await checkAiConnection({
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      baseURL: REAL_BASE_URL,
      reverseProxyUrl: REVERSE_PROXY_URL,
    })

    expect(chatModelFn).toHaveBeenCalledWith('deepseek-chat')
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    const callArgs = generateTextMock.mock.calls[0]?.[0] as { model: unknown; prompt: string }
    expect(callArgs.prompt).toBe('hello')
    expect(callArgs.model).toEqual({ modelId: 'deepseek-chat' })
  })

  it('throws when reverseProxyUrl is null', async () => {
    await expect(
      checkAiConnection({
        model: 'deepseek-chat',
        apiKey: 'sk-test',
        baseURL: REAL_BASE_URL,
        reverseProxyUrl: null,
      }),
    ).rejects.toThrow(/Reverse proxy is not available/)
  })

  it('throws when reverseProxyUrl is undefined', async () => {
    await expect(
      checkAiConnection({
        model: 'deepseek-chat',
        apiKey: 'sk-test',
        baseURL: REAL_BASE_URL,
        reverseProxyUrl: undefined as unknown as null,
      }),
    ).rejects.toThrow(/Reverse proxy is not available/)
  })

  it.each([
    ['model', { apiKey: 'k', baseURL: REAL_BASE_URL, reverseProxyUrl: REVERSE_PROXY_URL }, 'model is required'],
    ['apiKey', { model: 'm', baseURL: REAL_BASE_URL, reverseProxyUrl: REVERSE_PROXY_URL }, 'apiKey is required'],
    ['baseURL', { model: 'm', apiKey: 'k', reverseProxyUrl: REVERSE_PROXY_URL }, 'baseURL is required'],
  ])('throws "%s is required" when %s is empty', async (_label, partial, expected) => {
    await expect(checkAiConnection(partial as Parameters<typeof checkAiConnection>[0])).rejects.toThrow(expected)
  })

  it.each([
    ['model', { model: '   ', apiKey: 'k', baseURL: REAL_BASE_URL, reverseProxyUrl: REVERSE_PROXY_URL }, 'model is required'],
    ['apiKey', { model: 'm', apiKey: '   ', baseURL: REAL_BASE_URL, reverseProxyUrl: REVERSE_PROXY_URL }, 'apiKey is required'],
    ['baseURL', { model: 'm', apiKey: 'k', baseURL: '   ', reverseProxyUrl: REVERSE_PROXY_URL }, 'baseURL is required'],
  ])('throws "%s is required" when %s is whitespace', async (_label, partial, expected) => {
    await expect(checkAiConnection(partial as Parameters<typeof checkAiConnection>[0])).rejects.toThrow(expected)
  })

  it('propagates generateText errors unchanged so the UI can surface them', async () => {
    buildFakeProvider()
    const aiError = new Error('401 Unauthorized')
    generateTextMock.mockRejectedValueOnce(aiError)

    await expect(
      checkAiConnection({
        model: 'deepseek-chat',
        apiKey: 'sk-bad',
        baseURL: REAL_BASE_URL,
        reverseProxyUrl: REVERSE_PROXY_URL,
      }),
    ).rejects.toBe(aiError)
  })

  it('passes the user baseURL through X-SMM-Proxy-Upstream-BaseURL (not the proxy URL)', async () => {
    const { captured } = buildFakeProvider()

    await checkAiConnection({
      model: 'gpt-4o-mini',
      apiKey: 'sk-openai',
      baseURL: 'https://api.openai.com/v1',
      reverseProxyUrl: REVERSE_PROXY_URL,
    })

    expect(captured.config?.baseURL).toBe(REVERSE_PROXY_URL)
    expect(captured.config?.headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.openai.com/v1')
  })
})
