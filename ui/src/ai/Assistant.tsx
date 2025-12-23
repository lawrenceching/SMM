import { AssistantModal } from "@/components/assistant-modal";
import { AssistantRuntimeProvider, useAssistantApi } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { GetMediaFoldersTool, GetFilesInMediaFolderTool, GetMediaMetadataTool, MatchEpisodeTool } from "./tools";
import { useMediaMetadata } from "@/components/media-metadata-provider";
import { useEffect } from "react";



function ModelContext() {
    const api = useAssistantApi();
    const { selectedMediaMetadata} = useMediaMetadata();
    useEffect(() => {
        console.log(`re-register model context for media folder: ${selectedMediaMetadata?.mediaFolderPath}`);

        // Register context provider
        return api.modelContext().register({
          getModelContext: () => ({
            system: `你是Simple Media Manager(SMM) 软件内置的AI助手, 你专门帮助用户查询媒体库中的信息和辅助用户调用 SMM 的功能

你应该基于软件上下文信息回答问题, 当信息不足时,使用工具来获取信息和调用功能, 而不是凭空猜测.
调用工具后, 你应该根据工具输出的结果来回答用户问题, 而不是直接返回工具输出. 你需要回复整理, 总结和格式化后的结果给用户.

# 软件上下文

软件上下文用于描述 SMM 内部的状态. 当处理用户问题时, 你需要考虑软件上下文来理解用户的问题
例如, 当用户让你介绍电视剧信息时, 你应该从软件上下文中或者用户当前打开的媒体目录信息

## 当前媒体目录路径
${selectedMediaMetadata?.mediaFolderPath}

##SMM 版本号
v1.0.5
`,
          }),
        });

        
      }, [api, selectedMediaMetadata]);

      return <></>
}

export function Assistant() {
    
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/chat",
        }),
    });


    return <AssistantRuntimeProvider runtime={runtime}>
        <ModelContext/>
        {/* <GetMediaFoldersTool /> */}
        <GetFilesInMediaFolderTool />
        <GetMediaMetadataTool />
        <MatchEpisodeTool />
        <AssistantModal />

    </AssistantRuntimeProvider>
}