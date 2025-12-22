import type { HelloResponseBody } from "@core/types";

export async function hello(): Promise<HelloResponseBody> {
    const resp = await fetch('/api/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: 'hello',
        }),
    })

    const body = await resp.json() as HelloResponseBody;
    return body;

}