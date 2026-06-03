import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import type { OpenAICompatibleConfig } from '@core/types'

export interface SummarizeVideoInput {
  subtitleContent: string
  aiProvider: OpenAICompatibleConfig
  reverseProxyUrl: string
}

/**
 * Calls generateText via the reverse proxy to summarize subtitle content.
 *
 * The AI SDK provider is configured with:
 * - `baseURL`: the CLI reverse proxy URL (e.g. http://127.0.0.1:30005)
 * - `headers.X-SMM-Proxy-Upstream-BaseURL`: the actual AI provider's base URL
 * - `apiKey`: the user's API key
 *
 * @returns The generated summary text.
 */
export async function summarizeVideo({
  subtitleContent,
  aiProvider,
  reverseProxyUrl,
}: SummarizeVideoInput): Promise<string> {
  if (!aiProvider.baseURL) throw new Error('AI provider baseURL is not configured')
  if (!aiProvider.model) throw new Error('AI model is not configured')
  if (!reverseProxyUrl) throw new Error('Reverse proxy URL is not available')

  const provider = createOpenAICompatible({
    name: aiProvider.name ?? 'AI',
    baseURL: reverseProxyUrl,
    apiKey: aiProvider.apiKey,
    headers: {
      'X-SMM-Proxy-Upstream-BaseURL': aiProvider.baseURL,
    },
  })

  const systemPrompt = `你是一个视频内容总结助手。我将给你一段视频的字幕文本，请用中文对视频内容进行总结。

总结要求：
1. 提取视频的核心主题和关键信息
2. 保持客观，不要添加字幕中没有的内容
3. 结构清晰，分点列出重要内容
4. 如果字幕内容不适合总结（如纯歌曲歌词），请说明原因`

  try {
    const { text } = await generateText({
      model: provider.chatModel(aiProvider.model),
      system: systemPrompt,
      prompt: subtitleContent,
      abortSignal: AbortSignal.timeout(120_000), // 2 minute timeout
    })

    return text
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const lower = message.toLowerCase()
    // Network / connection errors
    if (lower.includes('fetch failed') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('networkerror') || lower.includes('econnrefused')) {
      throw new Error('Network connection failed. Please check your network and AI provider settings.')
    }
    // Timeout
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted') || message.includes('TimeOut')) {
      throw new Error('AI summary request timed out. The subtitle content may be too long.')
    }
    // Authentication errors
    if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('auth') || lower.includes('authentication')) {
      throw new Error('AI provider authentication failed. Please check your API key.')
    }
    // Rate limiting
    if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
      throw new Error('AI provider rate limit exceeded. Please try again later.')
    }
    // Server errors
    if ((message.includes('5') && (message.includes('500') || message.includes('502') || message.includes('503'))) || lower.includes('internal server error') || lower.includes('service unavailable')) {
      throw new Error('AI provider server error. Please try again later.')
    }
    // Re-throw other errors as-is
    throw error
  }
}
