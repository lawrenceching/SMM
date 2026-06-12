import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export interface CheckAiConnectionInput {
  model: string
  apiKey: string
  baseURL: string
  /**
   * The reverse proxy URL exposed by the backend (`HelloResponseBody.reverseProxyUrl`).
   * When `null` the backend reverse proxy is not yet started; this function throws
   * a descriptive error so the UI can surface it.
   */
  reverseProxyUrl: string | null
}

export interface CheckAiConnectionResult {
  status: 'ok'
  model: string
}

/**
 * Verifies AI provider connectivity by making a minimal text generation request
 * (`prompt: "hello"`) from the browser to the OpenAI-compatible provider, with
 * the request routed through the backend's reverse proxy.
 *
 * The reverse proxy URL is the backend's own listening URL (e.g.
 * `http://127.0.0.1:30005`). The proxy validates that the user-provided
 * `baseURL` is in its host allowlist and forwards the request to the real AI
 * provider, stripping the `X-SMM-Proxy-Upstream-BaseURL` control header.
 *
 * This mirrors the pattern used by `apps/ui/src/lib/summarizeVideo.ts` so the
 * browser can talk to any whitelisted AI provider without needing the backend
 * to hold the API key.
 *
 * @throws Error on validation failure, missing reverse proxy, or any
 *   network/AI provider error. The caller (AiSettings) catches and surfaces
 *   `err.message`.
 */
export async function checkAiConnection(
  input: CheckAiConnectionInput,
): Promise<CheckAiConnectionResult> {
  const { model, apiKey, baseURL, reverseProxyUrl } = input

  if (!model || !model.trim()) {
    throw new Error('model is required')
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('apiKey is required')
  }
  if (!baseURL || !baseURL.trim()) {
    throw new Error('baseURL is required')
  }
  if (!reverseProxyUrl) {
    throw new Error('Reverse proxy is not available. Please restart the backend.')
  }

  const provider = createOpenAICompatible({
    name: 'ai-check',
    baseURL: reverseProxyUrl,
    apiKey,
    headers: {
      'X-SMM-Proxy-Upstream-BaseURL': baseURL,
    },
  })

  await generateText({
    model: provider.chatModel(model),
    prompt: 'hello',
  })

  return { status: 'ok', model }
}
