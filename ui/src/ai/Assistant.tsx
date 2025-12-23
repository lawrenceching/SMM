import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { GetMediaFoldersTool, GetFilesInMediaFolderTool, MatchEpisodeTool } from "./tools";

export function Assistant() {
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/chat",
        }),
    });

    return <AssistantRuntimeProvider runtime={runtime}>
        <GetMediaFoldersTool />
        <GetFilesInMediaFolderTool />
        <MatchEpisodeTool />
        <AssistantModal />
    </AssistantRuntimeProvider>
}