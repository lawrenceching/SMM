
import { app } from 'electron'

export interface GetConfigResponse {
    userConfigPath: string;
}

export async function getConfigTask(): Promise<GetConfigResponse> {
    return {
        userConfigPath: app.getPath('userData')
    }
}