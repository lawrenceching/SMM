import type { HelloResponseBody } from "@core/types";

export async function hello(): Promise<HelloResponseBody> {
    const resp = await fetch('/api/hello', {
        method: 'POST',
    })

    const body = await resp.json() as HelloResponseBody;
    return body;

}
