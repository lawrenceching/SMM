import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider, useAssistantApi } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/providers/dialog-provider";
import { getOrCreateClientId } from "@/hooks/useWebSocket";
import { useConfig } from "@/hooks/userConfig/useConfig";
import { isHarmonyOS } from "@/lib/isHarmonyOS";
import { prompts } from "./prompts";
import { ReverseProxyChatTransport } from "./transport/reverseProxyChatTransport";
import { GetFilesInMediaFolderTool } from "./tools";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata";
import {
    injectPendingFolderNoticeIntoMessages,
    onSelectedFolderPathChanged,
} from "./pendingFolderSwitch";

function ModelContext() {
    const api = useAssistantApi();
    const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder);
    const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined)

    useEffect(() => {
        console.log(`re-register model context for media folder: ${selectedMediaMetadata?.mediaFolderPath}`);

        // Register context provider
        return api.modelContext().register({
          getModelContext: () => ({
            system: prompts.system,
          }),
        });

        
      }, [api, selectedMediaMetadata]);

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

function AssistantImpl() {

    const { userConfig, appConfig } = useConfig()
    const isHarmony = useMemo(() => isHarmonyOS(), [])

    const transport = useMemo(() => {
        if (isHarmony) {
            // HarmonyOS: no /api/chat on the ohos main process. Run the
            // AI SDK `streamText` call directly in the renderer and route
            // the request through the universal AI reverse proxy that
            // `apps/ohos/src/http/server.ts` already starts. The proxy
            // URL is exposed via `HelloResponseBody.reverseProxyUrl`
            // (`appConfig.reverseProxyUrl`).
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
        // its 14 server-side tools.
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
        {/* <GetMediaFoldersTool /> */}
        <GetFilesInMediaFolderTool />
        {/* <GetMediaMetadataTool />
        <MatchEpisodeTool /> */}
        <AssistantModal />

    </AssistantRuntimeProvider>
}
