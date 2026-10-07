import type { MoveFileToTrashRequestBody, MoveFileToTrashResponseBody } from '@smm/types';
import { rpc, unwrapJson } from '@/lib/rpc';

export async function moveFileToTrash(path: string): Promise<MoveFileToTrashResponseBody> {
  const req: MoveFileToTrashRequestBody = {
    path,
  };

  const resp = await rpc.api.moveFileToTrash.$post({ json: req });

  if (!resp.ok) {
    console.error(`[moveFileToTrash] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data = await unwrapJson(resp);
  if (data.error) {
    console.error(`[moveFileToTrash] API error`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
    throw new Error(data.error);
  }

  if (!data.data) {
    console.error(`[moveFileToTrash] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
    throw new Error('moveFileToTrash: empty response');
  }

  return data;
}
