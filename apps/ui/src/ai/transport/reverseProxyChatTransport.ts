import {
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
  convertToModelMessages,
  stepCountIs,
  streamText,
} from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { injectPendingFolderNoticeIntoMessages } from '../pendingFolderSwitch'
import { prompts } from '../prompts'

/**
 * Configuration for {@link ReverseProxyChatTransport}.
 *
 * The transport calls the AI SDK `streamText` directly in the renderer,
 * pointing the OpenAI-compatible provider at the backend reverse proxy.
 * The reverse proxy URL is the backend's own listening URL
 * (e.g. `http://127.0.0.1:30005`). The proxy validates that the
 * user-provided `baseURL` is in its host allowlist and forwards the
 * request to the real AI provider, stripping the
 * `X-SMM-Proxy-Upstream-BaseURL` control header.
 *
 * All fields are **optional**. When any of them is missing, the
 * transport returns a friendly assistant message in the chat thread
 * instead of throwing — SMM allows the user to run with no AI provider
 * configured. The unconfigured case is reported to the user as a normal
 * chat response (not an exception), so the AI Assistant modal always
 * works.
 */
export interface ReverseProxyChatTransportConfig {
  /** Model identifier (e.g. "deepseek-chat", "gpt-4o-mini"). */
  model?: string
  /** API key for the upstream AI provider. Sent through the reverse proxy. */
  apiKey?: string
  /**
   * User-provided AI baseURL (e.g. "https://api.deepseek.com/v1"). This is
   * sent as the `X-SMM-Proxy-Upstream-BaseURL` header so the reverse proxy
   * knows where to forward; the request body itself goes to
   * {@link reverseProxyUrl}.
   */
  baseURL?: string
  /**
   * Backend reverse proxy URL (sourced from
   * `HelloResponseBody.reverseProxyUrl`).
   */
  reverseProxyUrl?: string | null
}

/**
 * AI SDK {@link ChatTransport} that runs `streamText` in-process in the
 * browser and routes the request through the backend's universal AI
 * reverse proxy. Used by the AI Assistant on HarmonyOS where
 * `POST /api/chat` is not available.
 *
 * **Phase 1: chat-only.** No tools are passed to `streamText`; the LLM
 * is invoked once with `messages` and a system prompt, and the streamed
 * `UIMessageChunk` events are returned to `useChatRuntime`.
 *
 * `stopWhen: stepCountIs(100)` is passed today as a forward-compat shim:
 * it is a no-op without tools (the AI SDK default is `stepCountIs(1)`
 * and the LLM exits after one step because it cannot call any tools),
 * but it ensures that a future Phase 2 migration that adds tools will
 * automatically enable the multi-step agent loop without a second
 * touching this file. See `migrate-ai-assistant-to-reverse-proxy-on-ohos.md`
 * §5.1 Task 1 for the rationale.
 *
 * @example
 * ```tsx
 * const transport = new ReverseProxyChatTransport({
 *   model: 'deepseek-chat',
 *   apiKey: 'sk-...',
 *   baseURL: 'https://api.deepseek.com/v1',
 *   reverseProxyUrl: 'http://127.0.0.1:30005',
 * })
 * const runtime = useChatRuntime({ transport })
 * ```
 */
export class ReverseProxyChatTransport implements ChatTransport<UIMessage> {
  private readonly config: ReverseProxyChatTransportConfig

  constructor(config: ReverseProxyChatTransportConfig) {
    this.config = config
  }

  async sendMessages(
    options: Parameters<ChatTransport<UIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal, trigger } = options

    // Unconfigured-state guard. SMM allows the user to run with no AI
    // provider selected, so this is not an error — it is reported as a
    // normal assistant response in the chat thread. We synthesize a
    // single text chunk that names the missing field and points the
    // user at Settings → AI.
    const missingReason = this.describeMissingConfig()
    if (missingReason !== null) {
      return this.createAssistantTextStream(missingReason)
    }

    // Mirror the existing `prepareSendMessagesRequest` semantics: only
    // splice the folder-switch notice into the message list on a fresh
    // user submit, not on regenerate. The helper mutates the tracking
    // state internally so the same path is hit whether the call comes
    // from the Hono shell (desktop) or this in-process transport (ohos).
    const finalMessages =
      trigger === 'submit-message'
        ? injectPendingFolderNoticeIntoMessages(messages)
        : messages

    const provider = createOpenAICompatible({
      name: 'assistant',
      baseURL: this.config.reverseProxyUrl as string,
      apiKey: this.config.apiKey ?? '',
      headers: {
        'X-SMM-Proxy-Upstream-BaseURL': this.config.baseURL as string,
      },
    })

    const result = streamText({
      model: provider.chatModel(this.config.model as string),
      messages: await convertToModelMessages(finalMessages),
      system: prompts.system,
      stopWhen: stepCountIs(100),
      abortSignal,
    })

    // `toUIMessageStream()` returns an `AsyncIterableStream` which
    // extends `ReadableStream`, so it is a valid
    // `ReadableStream<UIMessageChunk>` for the `ChatTransport` contract.
    // (Do NOT use `toUIMessageStreamResponse()` — that wraps the stream
    // in a `Response` object intended for the HTTP transport path.)
    return result.toUIMessageStream() as unknown as ReadableStream<UIMessageChunk>
  }

  /**
   * No persistent server-side stream exists in this in-process
   * transport, so reconnection is not supported. Mirrors
   * `DirectChatTransport.reconnectToStream`, which returns `null` for
   * the same reason.
   */
  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  /**
   * Returns a short, user-facing reason string when the transport is
   * not fully configured, or `null` when it is ready to call the model.
   */
  private describeMissingConfig(): string | null {
    if (!this.config.reverseProxyUrl) {
      return 'The backend reverse proxy is not available. Please restart the backend. If the problem persists, open Settings → AI to verify the configuration.'
    }
    if (!this.config.baseURL || !this.config.baseURL.trim()) {
      return 'The selected AI provider is missing its baseURL. Please open Settings → AI to complete the configuration.'
    }
    if (!this.config.model || !this.config.model.trim()) {
      return 'The selected AI provider is missing its model. Please open Settings → AI to complete the configuration.'
    }
    return null
  }

  /**
   * Synthesizes a one-shot AI SDK UIMessage stream that contains a
   * single assistant text message. Used to surface unconfigured-state
   * guidance to the user through the normal chat flow without
   * throwing or otherwise aborting the render.
   */
  private createAssistantTextStream(text: string): ReadableStream<UIMessageChunk> {
    const messageId = `assistant-config-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    const chunks: UIMessageChunk[] = [
      { type: 'start', messageId },
      { type: 'text-start', id: messageId },
      { type: 'text-delta', id: messageId, delta: text },
      { type: 'text-end', id: messageId },
      { type: 'finish' },
    ]

    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
  }
}
