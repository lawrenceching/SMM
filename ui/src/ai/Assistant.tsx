import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { GetMediaFoldersTool } from "./tools/GetMediaFolders";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { GetFilesInMediaFolderTool } from "./tools/ListFilesInMediaFolder";

export function Assistant() {
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/chat",
        }),
    });

    return <AssistantRuntimeProvider runtime={runtime}>
        <GetMediaFoldersTool />
        <GetFilesInMediaFolderTool />
        <AssistantModal />
    </AssistantRuntimeProvider>
}