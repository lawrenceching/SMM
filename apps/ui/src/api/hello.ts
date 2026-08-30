import type { HelloResponseBody } from "@core/types";
import { apiFetch } from '@/lib/apiFetch';
import { syncPathServerPlatformFromHello } from '@/lib/syncPathServerPlatform';

export async function hello(): Promise<HelloResponseBody> {
    const resp = await apiFetch('/api/hello', {
        method: 'GET',
    })

    const body = await resp.json() as HelloResponseBody;
    syncPathServerPlatformFromHello(body);
    return body;

}
