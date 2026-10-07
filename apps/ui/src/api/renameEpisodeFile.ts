import { rpc, unwrapJson } from '@/lib/rpc'

export interface RenameEpisodeFileParams {
  mediaFolder: string
  from: string
  to: string
}

type RenameEpisodeFileResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['rename-episode-file']['$post']>>['json']>
>

/** Layer-2 episode rename via Core (`POST /api/rename-episode-file`). */
export async function renameEpisodeFile(
  params: RenameEpisodeFileParams,
  signal?: AbortSignal,
): Promise<RenameEpisodeFileResponseBody> {
  const resp = await rpc.api['rename-episode-file'].$post(
    {
      json: {
        mediaFolder: params.mediaFolder,
        from: params.from,
        to: params.to,
      },
    },
    { init: { signal } },
  )
  return unwrapJson(resp)
}

/** Throws on business error or per-file failures. */
export async function renameEpisodeFileViaCore(
  params: RenameEpisodeFileParams,
): Promise<void> {
  const body = await renameEpisodeFile(params)
  if ('error' in body) {
    throw new Error(body.error)
  }
  const failed = body.data.failed
  if (failed.length > 0) {
    throw new Error(failed.map((f) => f.error).join(', ') || 'Rename failed')
  }
}
