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

  const { text } = await generateText({
    model: provider.chatModel(aiProvider.model),
    system: systemPrompt,
    prompt: subtitleContent,
  })

  return text
}
