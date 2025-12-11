import { getConfigTask } from "./tasks/GetConfigTask";

export async function channelRoute(req: ExecuteChannelRequest): Promise<ExecuteChannelResponse> {

    switch(req.name) {
        case 'get-config':
            return {
                name: 'get-config',
                data: await getConfigTask()
            } as ExecuteChannelResponse;
        default:
            throw new Error(`Unknown channel: ${req.name}`);
    }

  
}