import {
  type ChatTransport,
  type Tool as AiTool,
  type ToolExecutionOptions,
  type UIMessage,
  type UIMessageChunk,
  convertToModelMessages,
  stepCountIs,
  streamText,
} from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { Tool as AssistantStreamTool } from '@assistant-ui/react'
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
  /**
   * AI tools to expose to the LLM. Each tool is an
   * assistant-stream `Tool` (the same shape that `makeAssistantTool`
   * produces — `{ description, parameters, execute }`), keyed by
   * `toolName`. Collected from the assistant-ui runtime in
   * `Assistant.tsx` via `useAssistantTools()`.
   *
   * When provided, the tools are converted to AI SDK's `streamText`
   * format (`parameters` → `inputSchema`) and passed to `streamText`'s
   * `tools` field. The LLM can then call them in-process in the
   * renderer (no server round-trip). `stopWhen: stepCountIs(100)`
   * becomes load-bearing in this mode (allows multi-step agent loop).
   *
   * When omitted (Phase 1 default), the transport runs chat-only —
   * the LLM is invoked once with `messages` + `system` and exits.
   */
  tools?: Record<string, AssistantStreamTool>
}

/**
 * AI SDK {@link ChatTransport} that runs `streamText` in-process in the
 * browser and routes the request through the backend's universal AI
 * reverse proxy. Used by the AI Assistant on HarmonyOS where
 * `POST /api/chat` is not available.
 *
 * **Phase 2: tools supported.** When `config.tools` is provided (the
 * normal case once `Assistant.tsx` is wired up), the tools are converted
 * to AI SDK's `streamText` format (`parameters` → `inputSchema`) and
 * passed to `streamText`'s `tools` field. The LLM can call them
 * in-process in the renderer (no server round-trip). `stopWhen:
 * stepCountIs(100)` enables the multi-step agent loop.
 *
 * When `config.tools` is omitted (Phase 1 fallback), the transport
 * still runs chat-only — the LLM is invoked once with `messages` +
 * `system` and exits after one step. This is the same forward-compat
 * shim that Phase 1 used, now generalized. See
 * `migrate-ai-assistant-to-reverse-proxy-on-ohos.md` §5.1 Task 1 for
 * the original rationale.
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
  /**
   * Mutable tools field. Can be updated via {@link setTools} from a
   * component that lives inside the assistant-ui `AuiProvider`
   * (and therefore has access to `useAssistantApi()`), so the tools
   * reflect the current assistant-ui model context without requiring
   * the transport itself to live inside the provider. Read in
   * {@link sendMessages} (preferring this over `config.tools` when
   * set), so an updated tool registration is picked up on the next
   * request without reconstructing the transport.
   */
  private mutableTools: Record<string, AssistantStreamTool> | undefined

  constructor(config: ReverseProxyChatTransportConfig) {
    this.config = config
  }

  /**
   * Updates the tools map used by {@link sendMessages}. Called by
   * `<ToolsBridge />` (which lives inside `AssistantRuntimeProvider`)
   * every time the assistant-ui runtime's model context changes.
   * Safe to call from any React effect; the next `sendMessages` call
   * reads the new value.
   */
  setTools(tools: Record<string, AssistantStreamTool> | undefined): void {
    this.mutableTools = tools
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

    const aiTools = this.toStreamTextTools(
      this.mutableTools ?? this.config.tools,
    )

    const result = streamText({
      model: provider.chatModel(this.config.model as string),
      messages: await convertToModelMessages(finalMessages),
      system: prompts.system,
      ...(aiTools ? { tools: aiTools } : {}),
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
   * Converts an assistant-stream `Tool` map (the shape produced by
   * `makeAssistantTool` — `{ description, parameters, execute }`) to
   * AI SDK's `streamText` `tools` format (`{ description, inputSchema,
   * execute }`).
   *
   * The field-name adaptation (`parameters` → `inputSchema`) is the
   * only difference between the two shapes; both accept
   * `StandardSchemaV1 | JSONSchema7` (assistant-stream's `parameters`
   * is a structural subset of AI SDK's `FlexibleSchema<INPUT>`).
   *
   * Returns `undefined` (not an empty object) when no tools are
   * configured, so `streamText`'s default tool behavior is preserved.
   */
  private toStreamTextTools(
    tools: Record<string, AssistantStreamTool> | undefined,
  ): Record<string, AiTool> | undefined {
    if (!tools) return undefined
    const entries = Object.entries(tools).filter(
      ([, t]) => t && typeof t === 'object',
    )
    if (entries.length === 0) return undefined
    return Object.fromEntries(
      entries.map(([name, t]) => {
        const aiTool: AiTool = {
          description: t.description,
          // `parameters` (StandardSchemaV1 | JSONSchema7) is
          // structurally a subset of `inputSchema`
          // (FlexibleSchema<INPUT>), so this assignment is safe at
          // runtime. The cast widens to AI SDK's broader schema type.
          inputSchema: t.parameters as AiTool['inputSchema'],
        }
        if (typeof t.execute === 'function') {
          // Wrap the assistant-stream `execute` in an adapter that
          // drops the `human` field from the call signature
          // (assistant-stream uses `ToolExecutionContext`, AI SDK
          // uses `ToolExecutionOptions` which lacks `human`). At
          // runtime the only field AI SDK passes that our tools read
          // is `abortSignal`; the rest is identical.
          const assistantExecute = t.execute as (
            args: unknown,
            context: { abortSignal?: AbortSignal },
          ) => unknown
          aiTool.execute = ((args: unknown, options: ToolExecutionOptions) =>
            assistantExecute(args, {
              abortSignal: options?.abortSignal,
            })) as AiTool['execute']
        }
        return [name, aiTool]
      }),
    )
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
