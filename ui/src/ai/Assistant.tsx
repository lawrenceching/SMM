import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider, useAssistantApi } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useMediaMetadata } from "@/components/media-metadata-provider";
import { useEffect } from "react";
import { getOrCreateClientId } from "@/hooks/useWebSocket";
import { prompts } from "./prompts";


function ModelContext() {
    const api = useAssistantApi();
    const { selectedMediaMetadata} = useMediaMetadata();
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

export function Assistant() {
    
    // https://www.assistant-ui.com/docs/runtimes/ai-sdk/use-chat#usechatruntime
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/chat",
            body: {
                clientId: getOrCreateClientId(),
            }
        }),
        onFinish: (options) => {
            if (options?.isAbort) {
                console.log('Request was aborted by user');
                // Handle abort case
            } else if (options?.isError) {
                console.error('Request finished with error:', options.error);
                // Handle error case
            } else {
                console.log('Request completed successfully');
                // Handle success case
            }
        }
    });


    return <AssistantRuntimeProvider runtime={runtime}>
        <ModelContext/>
        {/* <GetMediaFoldersTool /> */}
        {/* <GetFilesInMediaFolderTool />
        <GetMediaMetadataTool />
        <MatchEpisodeTool /> */}
        <AssistantModal />

    </AssistantRuntimeProvider>
}