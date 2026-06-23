import type { HelloResponseBody } from "@core/types";
import { apiFetch } from '@/lib/apiFetch';

export async function hello(): Promise<HelloResponseBody> {
    const resp = await apiFetch('/api/hello', {
        method: 'POST',
    })

    const body = await resp.json() as HelloResponseBody;
    return body;

}
