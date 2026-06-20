import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider, useAssistantApi } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/providers/dialog-provider";
import { getOrCreateClientId } from "@/hooks/useWebSocket";
import { useConfig } from "@/hooks/userConfig/useConfig";
import { useFeatures } from "@/hooks/useFeatures";
import { isHarmonyOS } from "@/lib/isHarmonyOS";
import { ReverseProxyChatTransport } from "./transport/reverseProxyChatTransport";
import { useAssistantTools } from "./hooks/useAssistantTools";
import {
    GetApplicationContextTool,
    GetMediaFoldersTool,
    GetFilesInMediaFolderTool,
    IsFolderExistTool,
    GetEpisodesTool,
    GetMediaMetadataTool,
    RenameFolderTool,
    BeginRecognizeTaskTool,
    AddRecognizedMediaFileTool,
    EndRecognizeTaskTool,
    BeginRenameFilesTaskTool,
    AddRenameFileToTaskTool,
    EndRenameFilesTaskTool,
} from "./tools";
import { AIBasedConfirmationBridge } from "./AIBasedConfirmationBridge";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata";
import {
    injectPendingFolderNoticeIntoMessages,
    onSelectedFolderPathChanged,
} from "./pendingFolderSwitch";
import { prompts } from "./prompts";

function ModelContext() {
    const api = useAssistantApi();

    useEffect(() => {
        // The system prompt is a compile-time constant from
        // `@core/ai-tool/systemPrompt` and never depends on
        // runtime state, so we register the context provider once
        // and let it remain stable for the lifetime of the
        // assistant-ui runtime.
        return api.modelContext().register({
          getModelContext: () => ({
            system: prompts.system,
          }),
        });
      }, [api]);

      return <></>
}

/** Marks folder path changes; notice is sent only on the next user submit (prepareSendMessagesRequest). */
function SelectedFolderSwitchNotifier() {
    const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder);
    const { data: selectedMediaMetadata } = useMediaMetadataQuery(
        selectedFolder || undefined,
    );
    const currentPath = selectedMediaMetadata?.mediaFolderPath ?? "";

    useEffect(() => {
        onSelectedFolderPathChanged(currentPath);
    }, [currentPath]);

    return null;
}

/**
 * Error boundary that catches render-time errors thrown by
 * `AssistantImpl` (notably the transport validation in `useMemo`) and
 * renders a friendly fallback with a button to open Settings → AI. Without
 * this boundary, a throw during render (e.g. when the AI provider is not
 * configured) would crash the whole page.
 */
class AssistantErrorBoundary extends Component<
    { children: ReactNode },
    { error: Error | null }
> {
    state = { error: null as Error | null }

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error("[Assistant] error caught by boundary:", error, info)
    }

    reset = () => {
        this.setState({ error: null })
    }

    render() {
        if (this.state.error) {
            return <AssistantErrorFallback error={this.state.error} onRetry={this.reset} />
        }
        return this.props.children
    }
}

/**
 * Fallback UI shown when the AI Assistant cannot construct its transport
 * (e.g. no AI provider is configured, or the reverse proxy is not
 * available on the backend). Offers an "Open Settings" button that
 * jumps straight to the AI tab so the user can fix the problem without
 * having to dig through the menu.
 */
function AssistantErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
    const { t } = useTranslation("components")
    const { configDialog } = useDialogs()
    const openConfig = configDialog[0]

    return (
        <div
            data-testid="assistant-error-fallback"
            className="fixed right-4 bottom-20 z-50 w-[360px] rounded-xl border bg-popover p-4 text-popover-foreground shadow-md"
        >
            <h3 className="text-sm font-semibold mb-2">
                {t("assistant.unavailableTitle" as never, { defaultValue: "AI Assistant is unavailable" })}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">
                {error.message}
            </p>
            <div className="flex gap-2 justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    data-testid="assistant-error-retry"
                >
                    {t("assistant.retry" as never, { defaultValue: "Retry" })}
                </Button>
                <Button
                    size="sm"
                    onClick={() => openConfig("ai")}
                    data-testid="assistant-error-open-settings"
                >
                    {t("assistant.openSettings" as never, { defaultValue: "Open Settings" })}
                </Button>
            </div>
        </div>
    )
}

export function Assistant() {
    return (
        <AssistantErrorBoundary>
            <AssistantImpl />
        </AssistantErrorBoundary>
    )
}

/**
 * Bridge component that lives inside `<AssistantRuntimeProvider>`
 * (where `useAssistantApi()` returns a real runtime, not the
 * throw-on-use default proxy) and forwards the tools registered in
 * the assistant-ui model context to the `ReverseProxyChatTransport`
 * via `transport.setTools(...)`. The next `sendMessages` call reads
 * the updated tools and passes them to `streamText`.
 *
 * Without this bridge, `useAssistantTools()` would have to be called
 * outside the provider (since the transport is constructed in
 * `AssistantImpl`, before `<AssistantRuntimeProvider>` mounts), which
 * silently returns an empty tools map — the symptom is that the LLM
 * never sees the client-side tools.
 */
function ToolsBridge({ transport }: { transport: ReverseProxyChatTransport | null }) {
  const assistantTools = useAssistantTools()
  useEffect(() => {
    console.log(
      "[ToolsBridge] forwarding tools to ReverseProxyChatTransport",
      { toolNames: Object.keys(assistantTools) },
    )
    transport?.setTools(assistantTools)
  }, [transport, assistantTools])
  return null
}

function AssistantImpl() {

    const { userConfig, appConfig } = useConfig()
    const { isUIAiChatTransportEnabled } = useFeatures()
    const isHarmony = useMemo(() => isHarmonyOS(), [])

    const transport = useMemo(() => {
        // Use the in-process `ReverseProxyChatTransport` when either:
        //   1. We're running on HarmonyOS (the ohos Electron main
        //      process doesn't expose `POST /api/chat`, so the Hono
        //      `AssistantChatTransport` would never reach a handler).
        //   2. The user has explicitly enabled
        //      `features.isUIAiChatTransportEnabled` via localStorage
        //      (useful for testing the in-process transport on
        //      desktop without rebuilding for HarmonyOS).
        // Otherwise (desktop / Electron default), keep using the Hono
        // `AssistantChatTransport` and let the CLI's server-side
        // `agentTools.getApplicationContext(clientId)` handle tool
        // execution (the existing pre-migration behavior).
        // const useFrontendTransport = isHarmony || isUIAiChatTransportEnabled
        const useFrontendTransport = isUIAiChatTransportEnabled

        if (useFrontendTransport) {
            // Renderer-side AI Assistant. Run the AI SDK `streamText`
            // call directly in the renderer and route the request
            // through the universal AI reverse proxy that
            // `apps/ohos/src/http/server.ts` (HarmonyOS) or
            // `packages/core-routes/src/reverseProxyNode.ts` (desktop
            // dev / forced via flag) starts. The proxy URL is exposed
            // via `HelloResponseBody.reverseProxyUrl`
            // (`appConfig.reverseProxyUrl`).
            //
            // Tools are forwarded dynamically by `<ToolsBridge />`
            // (rendered inside the provider below) via
            // `transport.setTools(...)` — they are NOT passed here in
            // the constructor because `useAssistantApi()` requires the
            // `<AuiProvider>` context, which is only available to
            // descendants of `<AssistantRuntimeProvider>`. The
            // constructor keeps the `tools` field for backwards
            // compat but the live value is read from
            // `transport.mutableTools` at `sendMessages` time.
            //
            // SMM allows the user to run with no AI provider selected.
            // The transport itself handles the unconfigured state by
            // emitting a friendly assistant text message in the chat
            // thread (see `ReverseProxyChatTransport.describeMissingConfig`),
            // so this memo never throws. The `AssistantErrorBoundary`
            // wrapper above remains as defense in depth for truly
            // unexpected render-phase errors.
            const selectedName = userConfig.selectedAIProvider?.trim() ?? ""
            const provider = selectedName
                ? (userConfig.aiProviders ?? []).find((p) => p.name === selectedName)
                : undefined
            return new ReverseProxyChatTransport({
                model: provider?.model,
                apiKey: provider?.apiKey,
                baseURL: provider?.baseURL,
                reverseProxyUrl: appConfig.reverseProxyUrl,
            })
        }
        // Desktop / Electron: keep the existing flow. The Hono shell at
        // `apps/cli/src/route/ChatTask.ts` handles the agent loop with
        // its 14 server-side tools. The client-side `<GetApplicationContextTool />`
        // also registers in the renderer (its schema is sent via
        // `body.tools`), but `ChatTask.ts`'s `tools` object literal puts
        // `agentTools.getApplicationContext(clientId)` AFTER
        // `...frontendTools(tools)`, so the server-side tool wins by
        // key precedence — desktop LLM still calls the server-side tool
        // (Socket.IO + Bun.file), behavior unchanged.
        return new AssistantChatTransport({
            api: "/api/chat",
            body: {
                clientId: getOrCreateClientId(),
            },
            prepareSendMessagesRequest: async (options) => {
                if (options.trigger !== "submit-message") {
                    // Omit `body` so AssistantChatTransport applies default merge (incl. resolved thread id).
                    return {} as never;
                }
                const messages = injectPendingFolderNoticeIntoMessages(
                    options.messages,
                );
                if (messages === options.messages) {
                    return {} as never;
                }
                return {
                    body: {
                        ...options.body,
                        id: options.id,
                        messages,
                        trigger: options.trigger,
                        messageId: options.messageId,
                        metadata: options.requestMetadata,
                    },
                };
            },
        })
    }, [
        isHarmony,
        isUIAiChatTransportEnabled,
        userConfig.selectedAIProvider,
        userConfig.aiProviders,
        appConfig.reverseProxyUrl,
    ])

    // https://www.assistant-ui.com/docs/runtimes/ai-sdk/use-chat#usechatruntime
    const runtime = useChatRuntime({
        transport,
        onFinish: (options) => {
            if (options?.isAbort) {
                console.log('Request was aborted by user');
                // Handle abort case
            } else if (options?.isError) {
                console.error('Request finished with error');
                // Handle error case
            } else {
                console.log('Request completed successfully');
                // Handle success case
            }
        }
    });


    return <AssistantRuntimeProvider runtime={runtime}>
        <SelectedFolderSwitchNotifier />
        <ModelContext/>
        <GetFilesInMediaFolderTool />
        <GetApplicationContextTool />
        <IsFolderExistTool />
        <GetEpisodesTool />
        <RenameFolderTool />
        <BeginRecognizeTaskTool />
        <AddRecognizedMediaFileTool />
        <EndRecognizeTaskTool />
        <BeginRenameFilesTaskTool />
        <AddRenameFileToTaskTool />
        <EndRenameFilesTaskTool />
        <GetMediaMetadataTool />
        <GetMediaFoldersTool />
        <AIBasedConfirmationBridge />
        <ToolsBridge
            transport={
                transport instanceof ReverseProxyChatTransport ? transport : null
            }
        />
        <AssistantModal />

    </AssistantRuntimeProvider>
}
