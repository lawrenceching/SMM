export interface HelloResponse {
    /**
     * application uptime in seconds
     */
    uptime: number;
}

export async function executeHelloTask(): Promise<HelloResponse> {
  return {
    uptime: process.uptime(),
  }
}