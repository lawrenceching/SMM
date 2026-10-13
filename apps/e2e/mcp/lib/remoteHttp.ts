import type { MediaMetadata, SetMetadataRequestBody } from '@smm/types'
import { Path } from '@smm/utils/path'

export type MetadataPatch = SetMetadataRequestBody['patch']

type StandardApiBody = {
  data?: unknown
  error?: string | null
}

function normalizeHttpBase(httpBase: string): string {
  return httpBase.replace(/\/$/, '')
}

export function remoteAuthHeaders(
  authToken: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

function apiUrl(httpBase: string, path: string): string {
  return `${normalizeHttpBase(httpBase)}${path}`
}

async function readResponseText(resp: Response): Promise<string> {
  try {
    const text = await resp.text()
    if (text) {
      return text
    }
  } catch {
    // fall through — some test mocks only implement json()
  }
  try {
    return JSON.stringify(await resp.json())
  } catch {
    return ''
  }
}

function throwRemoteHttpError(
  label: string,
  resp: Response,
  bodyText: string,
): never {
  const snippet = bodyText.length > 500 ? `${bodyText.slice(0, 500)}…` : bodyText
  throw new Error(
    `${label} failed: HTTP ${resp.status} ${resp.statusText}${snippet ? ` — ${snippet}` : ''}`,
  )
}

async function postStandardJson(
  httpBase: string,
  authToken: string,
  path: string,
  body: unknown,
  options?: { throwOnBusinessError?: boolean },
): Promise<StandardApiBody> {
  const throwOnBusinessError = options?.throwOnBusinessError ?? true
  const resp = await fetch(apiUrl(httpBase, path), {
    method: 'POST',
    headers: remoteAuthHeaders(authToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await readResponseText(resp)
  let parsed: StandardApiBody = {}
  if (text) {
    try {
      parsed = JSON.parse(text) as StandardApiBody
    } catch {
      if (!resp.ok) {
        throwRemoteHttpError(path, resp, text)
      }
      throw new Error(`${path}: response was not JSON: ${text.slice(0, 200)}`)
    }
  }
  if (!resp.ok) {
    throwRemoteHttpError(path, resp, text || JSON.stringify(parsed))
  }
  if (throwOnBusinessError && parsed.error) {
    throw new Error(parsed.error)
  }
  return parsed
}

async function postMetadata(
  httpBase: string,
  authToken: string,
  path: string,
  body: unknown,
): Promise<{ data: MediaMetadata | true | null; status: number }> {
  const resp = await fetch(apiUrl(httpBase, path), {
    method: 'POST',
    headers: remoteAuthHeaders(authToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await readResponseText(resp)
  if (!resp.ok) {
    if (resp.status === 404) {
      return { data: null, status: resp.status }
    }
    throwRemoteHttpError(path, resp, text)
  }
  if (!text) {
    throw new Error(`${path}: empty response body`)
  }
  const parsed = JSON.parse(text) as { data?: MediaMetadata | true }
  return { data: parsed.data ?? null, status: resp.status }
}

function strictCreateMetadataPayload(metadata: MediaMetadata): MediaMetadata {
  return {
    mediaFolderPath: metadata.mediaFolderPath,
    type: metadata.type,
    mediaFiles: metadata.mediaFiles,
    tvShow: metadata.tvShow,
    movie: metadata.movie,
  }
}

export async function fetchRemoteHello(
  httpBase: string,
  authToken: string,
): Promise<{ userDataDir: string; appDataDir: string; tmpDir?: string }> {
  const resp = await fetch(apiUrl(httpBase, '/api/hello'), {
    method: 'GET',
    headers: remoteAuthHeaders(authToken),
    signal: AbortSignal.timeout(10_000),
  })
  const text = await readResponseText(resp)
  if (!resp.ok) {
    throwRemoteHttpError('/api/hello', resp, text)
  }
  const body = JSON.parse(text) as {
    userDataDir?: string
    appDataDir?: string
    tmpDir?: string
    error?: string
  }
  if (body.error) {
    throw new Error(body.error)
  }
  if (!body.userDataDir || !body.appDataDir) {
    throw new Error('/api/hello: userDataDir or appDataDir missing')
  }
  return {
    userDataDir: body.userDataDir,
    appDataDir: body.appDataDir,
    tmpDir: body.tmpDir,
  }
}

async function patchUserConfig(
  httpBase: string,
  authToken: string,
  patch: Array<{ op: string; path: string; value?: unknown }>,
  options?: { throwOnBusinessError?: boolean },
): Promise<StandardApiBody> {
  return postStandardJson(httpBase, authToken, '/api/patchUserConfig', { patch }, options)
}

export async function patchRemoteUserConfigFolders(
  httpBase: string,
  authToken: string,
  folders: string[],
): Promise<void> {
  const replaceResult = await patchUserConfig(
    httpBase,
    authToken,
    [{ op: 'replace', path: '/folders', value: folders }],
    { throwOnBusinessError: false },
  )
  if (!replaceResult.error) {
    return
  }

  const addResult = await patchUserConfig(httpBase, authToken, [
    { op: 'add', path: '/folders', value: folders },
  ])
  if (addResult.error) {
    throw new Error(addResult.error)
  }
}

export async function createRemoteMetadata(
  httpBase: string,
  authToken: string,
  data: MediaMetadata,
): Promise<void> {
  const { data: created } = await postMetadata(httpBase, authToken, '/api/create-metadata', {
    data: strictCreateMetadataPayload(data),
  })
  if (!created || created === true) {
    throw new Error('/api/create-metadata: response.data is missing')
  }
}

export async function setRemoteMetadata(
  httpBase: string,
  authToken: string,
  path: string,
  patch: MetadataPatch,
): Promise<void> {
  const { data: updated } = await postMetadata(httpBase, authToken, '/api/set-metadata', {
    path,
    patch,
  })
  if (!updated || updated === true) {
    throw new Error('/api/set-metadata: response.data is missing')
  }
}

export async function deleteRemoteMetadata(
  httpBase: string,
  authToken: string,
  path: string,
): Promise<void> {
  const { data, status } = await postMetadata(httpBase, authToken, '/api/delete-metadata', {
    path,
  })
  if (data === null && status === 404) {
    return
  }
  if (data !== true) {
    throw new Error('/api/delete-metadata: response.data is missing')
  }
}

async function getRemoteMetadata(
  httpBase: string,
  authToken: string,
  folderPath: string,
): Promise<MediaMetadata | null> {
  const { data } = await postMetadata(httpBase, authToken, '/api/get-metadata', {
    path: folderPath,
  })
  if (data === null || data === true) {
    return null
  }
  return data
}

export async function writeRemoteMediaMetadata(
  httpBase: string,
  authToken: string,
  data: MediaMetadata,
): Promise<void> {
  const folderPath = data.mediaFolderPath
  if (folderPath === undefined || folderPath === '') {
    throw new Error('writeRemoteMediaMetadata: mediaMetadata.mediaFolderPath is required')
  }

  const normalized: MediaMetadata = {
    ...data,
    mediaFolderPath: Path.posix(folderPath),
  }
  const existing = await getRemoteMetadata(httpBase, authToken, normalized.mediaFolderPath)
  if (existing === null) {
    await createRemoteMetadata(httpBase, authToken, normalized)
  } else {
    await setRemoteMetadata(httpBase, authToken, normalized.mediaFolderPath, {
      mediaFiles: normalized.mediaFiles,
      type: normalized.type,
      tvShow: normalized.tvShow,
      movie: normalized.movie,
    })
  }
}
