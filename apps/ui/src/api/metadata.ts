import type {
  MediaMetadata,
  MetadataSuccessResponseBody,
  ProblemDetails,
  SetMetadataRequestBody,
} from "@core/types"
import { apiFetch } from "@/lib/apiFetch"

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

async function postMetadataRpc(
  endpoint: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<MetadataSuccessResponseBody> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const problem = (await response.json()) as ProblemDetails
    throw new MetadataHttpError(problem, response.status)
  }

  return (await response.json()) as MetadataSuccessResponseBody
}

function requireMetadata(
  response: MetadataSuccessResponseBody,
  endpoint: string,
): MediaMetadata {
  if (!response.data || response.data === true) {
    throw new Error(`${endpoint}: response.data is missing`)
  }
  return response.data
}

export async function getMetadata(
  path: string,
  signal?: AbortSignal,
): Promise<MediaMetadata> {
  return requireMetadata(
    await postMetadataRpc("/api/get-metadata", { path }, signal),
    "/api/get-metadata",
  )
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
  return requireMetadata(
    await postMetadataRpc("/api/create-metadata", { data: payload }),
    "/api/create-metadata",
  )
}

export async function setMetadata(
  path: string,
  patch: MetadataPatch,
): Promise<MediaMetadata> {
  return requireMetadata(
    await postMetadataRpc("/api/set-metadata", { path, patch }),
    "/api/set-metadata",
  )
}

export async function deleteMetadata(path: string): Promise<void> {
  await postMetadataRpc("/api/delete-metadata", { path })
}
