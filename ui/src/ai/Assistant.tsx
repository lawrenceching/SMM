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
    
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/chat",
            body: {
                clientId: getOrCreateClientId(),
            }
        }),
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