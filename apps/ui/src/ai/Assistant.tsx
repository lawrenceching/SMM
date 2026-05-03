import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider, useAssistantApi } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useEffect, useMemo } from "react";
import { getOrCreateClientId } from "@/hooks/useWebSocket";
import { prompts } from "./prompts";
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

export function Assistant() {

    const transport = useMemo(
        () =>
            new AssistantChatTransport({
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
            }),
        [],
    );

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
