import { getConfigTask } from "./tasks/GetConfigTask";
import { openInFileManager } from "./tasks/OpenInFileManagerTask";

export async function channelRoute(req: ExecuteChannelRequest): Promise<ExecuteChannelResponse> {

    switch(req.name) {
        case 'get-config':
            return {
                name: 'get-config',
                data: await getConfigTask()
            } as ExecuteChannelResponse;
        case 'open-in-file-manager':
            return {
                name: 'open-in-file-manager',
                data: await openInFileManager(req.data)
            } as ExecuteChannelResponse;
        default:
            throw new Error(`Unknown channel: ${req.name}`);
    }

  
}