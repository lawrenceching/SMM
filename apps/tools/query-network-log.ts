#!/usr/bin/env bun

import * as fs from 'node:fs'
import { parseArgs } from 'node:util'

const HELP = `Usage: bun apps/tools/query-network-log.ts -f <network-log.json> [options]

List requests (default):
  bun apps/tools/query-network-log.ts -f <file> [--urlStartsWith <prefix>]
  Output: [request id] [url]

Query by request id:
  bun apps/tools/query-network-log.ts -f <file> --request-id <id> [--output-format curl-like]
  Output: curl verbose-style HTTP dump (> request, < response)`

type NetworkLogPhase = 'request' | 'response' | 'error'
type OutputFormat = 'curl-like'

type NetworkLogEntry = {
    timestamp: string
    phase: NetworkLogPhase
    event: unknown
}

type NetworkLogFile = {
    cid: string
    spec: string
    capturedAt: string
    entries: NetworkLogEntry[]
}

type RequestInfo = {
    requestId: string
    url: string
}

type Header = {
    name: string
    value: string
}

type RequestDetail = {
    requestId: string
    method: string
    url: string
    headers: Header[]
    body: string | undefined
    responseStatus: number | undefined
    responseStatusText: string | undefined
    responseHeaders: Header[]
    responseBody: string | undefined
    responseBodyNote: string | undefined
    errorText: string | undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readHeaderValue(value: unknown): string | undefined {
    const direct = readString(value)
    if (direct) {
        return direct
    }

    const record = asRecord(value)
    return record ? readString(record.value) : undefined
}

function readHeaders(value: unknown): Header[] {
    if (!Array.isArray(value)) {
        return []
    }

    const seen = new Set<string>()
    const headers: Header[] = []

    for (const item of value) {
        const record = asRecord(item)
        const name = record ? readString(record.name) : undefined
        const headerValue = record ? readHeaderValue(record.value) : undefined

        if (!name || headerValue === undefined) {
            continue
        }

        const key = name.toLowerCase()
        if (seen.has(key)) {
            continue
        }

        seen.add(key)
        headers.push({ name, value: headerValue })
    }

    return headers
}

function readRequestRecord(event: unknown): Record<string, unknown> | undefined {
    return asRecord(asRecord(event)?.request)
}

function readResponseRecord(event: unknown): Record<string, unknown> | undefined {
    return asRecord(asRecord(event)?.response)
}

function readRequestId(event: unknown): string | undefined {
    return readString(readRequestRecord(event)?.request)
}

function readRequestInfo(event: unknown): RequestInfo | undefined {
    const request = readRequestRecord(event)
    if (!request) {
        return undefined
    }

    const url = readString(request.url)
    const requestId = readString(request.request)

    if (!url || !requestId) {
        return undefined
    }

    return { requestId, url }
}

function readRequestBody(request: Record<string, unknown>): string | undefined {
    return (
        readString(request['goog:postData']) ??
        readString(request.postData) ??
        readString(request.body)
    )
}

function readResponseBody(response: Record<string, unknown>): {
    body: string | undefined
    note: string | undefined
} {
    const content = asRecord(response.content)
    if (!content) {
        const bodySize = response.bodySize
        if (typeof bodySize === 'number' && bodySize > 0) {
            return { body: undefined, note: `(not captured, ${bodySize} bytes)` }
        }
        return { body: undefined, note: '(empty)' }
    }

    const text =
        readString(content.text) ??
        readString(content.value) ??
        (typeof content === 'string' ? content : undefined)

    if (text) {
        return { body: text, note: undefined }
    }

    const size = content.size
    if (typeof size === 'number') {
        return { body: undefined, note: `(not captured, ${size} bytes)` }
    }

    const bodySize = response.bodySize
    if (typeof bodySize === 'number' && bodySize > 0) {
        return { body: undefined, note: `(not captured, ${bodySize} bytes)` }
    }

    return { body: undefined, note: '(empty)' }
}

function formatRequestLine(method: string, url: string): string {
    const parsed = new URL(url)
    const target = `${parsed.pathname}${parsed.search}` || '/'
    return `${method} ${target} HTTP/1.1`
}

function formatCurlLike(detail: RequestDetail): string {
    const lines: string[] = []

    lines.push(`> ${formatRequestLine(detail.method, detail.url)}`)
    for (const header of detail.headers) {
        lines.push(`> ${header.name}: ${header.value}`)
    }
    lines.push('>')

    if (detail.body) {
        lines.push(detail.body)
    }

    if (detail.errorText) {
        if (detail.body) {
            lines.push('')
        }
        lines.push(`* ${detail.errorText}`)
        return lines.join('\n')
    }

    if (detail.responseStatus === undefined) {
        if (detail.body) {
            lines.push('')
        }
        lines.push('* (no response captured)')
        return lines.join('\n')
    }

    if (detail.body) {
        lines.push('')
    }

    const statusText = detail.responseStatusText ? ` ${detail.responseStatusText}` : ''
    lines.push(`< HTTP/1.1 ${detail.responseStatus}${statusText}`)
    for (const header of detail.responseHeaders) {
        lines.push(`< ${header.name}: ${header.value}`)
    }
    lines.push('<')

    if (detail.responseBody) {
        lines.push(detail.responseBody)
    } else if (detail.responseBodyNote) {
        lines.push(detail.responseBodyNote)
    }

    return lines.join('\n')
}

function loadNetworkLog(filePath: string): NetworkLogFile {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as NetworkLogFile

    if (!Array.isArray(parsed.entries)) {
        throw new Error('Invalid network log: missing entries array')
    }

    return parsed
}

function queryNetworkLog(filePath: string, urlStartsWith?: string): RequestInfo[] {
    const log = loadNetworkLog(filePath)
    const results: RequestInfo[] = []

    for (const entry of log.entries) {
        if (entry.phase !== 'request') {
            continue
        }

        const info = readRequestInfo(entry.event)
        if (!info) {
            continue
        }

        if (urlStartsWith && !info.url.startsWith(urlStartsWith)) {
            continue
        }

        results.push(info)
    }

    return results
}

function findRequestDetail(log: NetworkLogFile, requestId: string): RequestDetail {
    let requestEntry: NetworkLogEntry | undefined
    let responseEntry: NetworkLogEntry | undefined
    let errorEntry: NetworkLogEntry | undefined

    for (const entry of log.entries) {
        if (readRequestId(entry.event) !== requestId) {
            continue
        }

        if (entry.phase === 'request' && !requestEntry) {
            requestEntry = entry
        } else if (entry.phase === 'response' && !responseEntry) {
            responseEntry = entry
        } else if (entry.phase === 'error' && !errorEntry) {
            errorEntry = entry
        }
    }

    if (!requestEntry) {
        throw new Error(`Request id not found: ${requestId}`)
    }

    const request = readRequestRecord(requestEntry.event)
    if (!request) {
        throw new Error(`Request id not found: ${requestId}`)
    }

    const url = readString(request.url)
    const method = readString(request.method) ?? 'GET'
    if (!url) {
        throw new Error(`Request id not found: ${requestId}`)
    }

    const response = responseEntry ? readResponseRecord(responseEntry.event) : undefined
    const { body: responseBody, note: responseBodyNote } = response
        ? readResponseBody(response)
        : { body: undefined, note: undefined }

    return {
        requestId,
        method,
        url,
        headers: readHeaders(request.headers),
        body: readRequestBody(request),
        responseStatus:
            response && typeof response.status === 'number' ? response.status : undefined,
        responseStatusText: response ? readString(response.statusText) : undefined,
        responseHeaders: response ? readHeaders(response.headers) : [],
        responseBody,
        responseBodyNote,
        errorText: errorEntry ? readString(asRecord(errorEntry.event)?.errorText) : undefined,
    }
}

function parseOutputFormat(value: string | undefined): OutputFormat | undefined {
    if (!value) {
        return undefined
    }

    if (value === 'curl-like') {
        return value
    }

    throw new Error(`Unsupported output format: ${value}`)
}

const { values } = parseArgs({
    options: {
        file: { type: 'string', short: 'f' },
        urlStartsWith: { type: 'string' },
        'request-id': { type: 'string' },
        'output-format': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
})

if (values.help) {
    console.log(HELP)
    process.exit(0)
}

if (!values.file) {
    console.error('Error: --file/-f is required')
    console.error(HELP)
    process.exit(2)
}

try {
    const requestId = values['request-id']
    const outputFormat = parseOutputFormat(values['output-format'])

    if (requestId) {
        const format = outputFormat ?? 'curl-like'
        if (format !== 'curl-like') {
            throw new Error(`Unsupported output format: ${format}`)
        }

        const log = loadNetworkLog(values.file)
        const detail = findRequestDetail(log, requestId)
        console.log(formatCurlLike(detail))
        process.exit(0)
    }

    if (outputFormat) {
        throw new Error('--output-format requires --request-id')
    }

    const results = queryNetworkLog(values.file, values.urlStartsWith)

    if (results.length === 0) {
        console.log('(no requests found)')
    } else {
        const total = results.length
        for (const { requestId: id, url } of results.slice(0, 10)) {
            console.log(`${id} ${url}`)
        }
        if (total > 10) {
            console.log(`${total} requests found in total, output is truncated to 10`)
            console.log('Use more accurate filter to narrow down the result')
        }
    }
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: ${message}`)
    process.exit(1)
}
