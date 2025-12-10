import { APP_VERSION } from '../src/version';

export interface HelloResponse {
    /**
     * application uptime in seconds
     */
    uptime: number;
    version: string;
}

export async function executeHelloTask(): Promise<HelloResponse> {
  return {
    uptime: process.uptime(),
    version: APP_VERSION,
  }
}