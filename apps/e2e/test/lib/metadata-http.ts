import type {
    MediaMetadata,
    MetadataSuccessResponseBody,
    SetMetadataRequestBody,
} from '@smm/core/types'
import { browser } from '@wdio/globals'
import { ensureBrowserOnUiPage } from './browser-fs'

export type MetadataPatch = SetMetadataRequestBody['patch']

type MetadataHttpResult = {
    ok: boolean
    status: number
    text: string
}

/**
 * Runs in the browser page so metadata requests use the app's same-origin API.
 * Keep this function closure-free because WebdriverIO serializes it.
 */
export async function metadataHttpRequestInPage(
    endpoint: string,
    body: unknown,
    fallbackToken?: string,
): Promise<MetadataHttpResult> {
    const pageLocation = (globalThis as { location?: Location }).location
    const storage = (globalThis as { localStorage?: Storage }).localStorage
    const token = new URLSearchParams(pageLocation?.search ?? '').get('token')
        ?? storage?.getItem('smm-auth-token')
        ?? fallbackToken
    const headers: Record<string, string> = {
        'content-type': 'application/json',
    }
    if (token) {
        headers.authorization = `Bearer ${token}`
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    })

    return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
    }
}

async function postMetadataViaBrowser(
    endpoint: string,
    body: unknown,
): Promise<{ response: MetadataSuccessResponseBody | null; status: number }> {
    await ensureBrowserOnUiPage()
    const result = await browser.execute(
        metadataHttpRequestInPage,
        endpoint,
        body,
        process.env.SMM_AUTH_TOKEN,
    ) as unknown as MetadataHttpResult

    if (!result.ok) {
        if (result.status === 404) {
            return { response: null, status: result.status }
        }
        throw new Error(`${endpoint} failed (${result.status}): ${result.text}`)
    }

    return {
        response: JSON.parse(result.text) as MetadataSuccessResponseBody,
        status: result.status,
    }
}

function requireMetadata(
    endpoint: string,
    response: MetadataSuccessResponseBody | null,
): MediaMetadata {
    if (!response?.data || response.data === true) {
        throw new Error(`${endpoint}: response.data is missing`)
    }
    return response.data
}

export async function getMetadataViaBrowser(folderPath: string): Promise<MediaMetadata | null> {
    const { response } = await postMetadataViaBrowser('/api/get-metadata', { path: folderPath })
    return response === null
        ? null
        : requireMetadata('/api/get-metadata', response)
}

export async function createMetadataViaBrowser(
    metadata: MediaMetadata,
): Promise<MediaMetadata> {
    // Strict create schema rejects UI-only keys (files, status, …).
    const payload: MediaMetadata = {
        mediaFolderPath: metadata.mediaFolderPath,
        type: metadata.type,
        mediaFiles: metadata.mediaFiles,
        tvShow: metadata.tvShow,
        movie: metadata.movie,
    }
    const { response } = await postMetadataViaBrowser('/api/create-metadata', { data: payload })
    return requireMetadata('/api/create-metadata', response)
}

export async function setMetadataViaBrowser(
    folderPath: string,
    patch: MetadataPatch,
): Promise<MediaMetadata> {
    const { response } = await postMetadataViaBrowser('/api/set-metadata', {
        path: folderPath,
        patch,
    })
    return requireMetadata('/api/set-metadata', response)
}

export async function deleteMetadataViaBrowser(folderPath: string): Promise<void> {
    const { response, status } = await postMetadataViaBrowser('/api/delete-metadata', {
        path: folderPath,
    })
    if (response === null && status === 404) {
        return
    }
    if (response?.data !== true) {
        throw new Error('/api/delete-metadata: response.data is missing')
    }
}
