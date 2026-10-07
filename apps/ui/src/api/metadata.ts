import type { MediaMetadata, ProblemDetails, SetMetadataRequestBody } from "@smm/types"
import { rpc, unwrapJson } from "@/lib/rpc"

export type MetadataPatch = SetMetadataRequestBody["patch"]

export class MetadataHttpError extends Error {
  problem: ProblemDetails
  status: number

  constructor(problem: ProblemDetails, status: number) {
    super(problem.detail || problem.title)
    this.name = "MetadataHttpError"
    this.problem = problem
    this.status = status
  }
}

export async function getMetadata(
  path: string,
  signal?: AbortSignal,
): Promise<MediaMetadata> {
  const resp = await rpc.api["get-metadata"].$post(
    { json: { path } },
    { init: { signal } },
  )
  if (!resp.ok) {
    const problem = await resp.json()
    throw new MetadataHttpError(problem, resp.status)
  }
  const body = await unwrapJson(resp)
  return body.data
}

export async function createMetadata(
  data: MediaMetadata,
): Promise<MediaMetadata> {
  // Strict create schema rejects UI-only keys (files, status, …).
  const payload: MediaMetadata = {
    mediaFolderPath: data.mediaFolderPath,
    type: data.type,
    mediaFiles: data.mediaFiles,
    tvShow: data.tvShow,
    movie: data.movie,
  }
  const resp = await rpc.api["create-metadata"].$post({ json: { data: payload } })
  if (!resp.ok) {
    const problem = await resp.json()
    throw new MetadataHttpError(problem, resp.status)
  }
  const body = await unwrapJson(resp)
  return body.data
}

export async function setMetadata(
  path: string,
  patch: MetadataPatch,
): Promise<MediaMetadata> {
  const resp = await rpc.api["set-metadata"].$post({ json: { path, patch } })
  if (!resp.ok) {
    const problem = await resp.json()
    throw new MetadataHttpError(problem, resp.status)
  }
  const body = await unwrapJson(resp)
  return body.data
}

export async function deleteMetadata(path: string): Promise<void> {
  const resp = await rpc.api["delete-metadata"].$post({ json: { path } })
  if (!resp.ok) {
    const problem = await resp.json()
    throw new MetadataHttpError(problem, resp.status)
  }
  await unwrapJson(resp)
}
