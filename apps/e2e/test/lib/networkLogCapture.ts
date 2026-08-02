import * as fs from 'node:fs'
import * as path from 'node:path'
import { redactSecretsInText } from './artifactSecretRedact'

export const NETWORK_LOG_DIR = './reports/network-logs'

export type NetworkLogPhase = 'request' | 'response' | 'error'

export type NetworkLogEntry = {
    timestamp: string
    phase: NetworkLogPhase
    event: unknown
}

export type NetworkLogFile = {
    cid: string
    spec: string
    capturedAt: string
    entries: NetworkLogEntry[]
}

let workerCid = 'unknown'
let specLabel = 'unknown'
const networkLog: NetworkLogEntry[] = []

export function isNetworkLogEnabled(): boolean {
    return process.env.NETWORK_LOG_ENABLED === 'true'
}

export function initNetworkLogCapture(cid: string, specs: string[]): void {
    workerCid = cid
    specLabel = specs[0] ? path.basename(specs[0]) : 'unknown'
    networkLog.length = 0
}

export function clearNetworkLogDir(): void {
    if (!fs.existsSync(NETWORK_LOG_DIR)) {
        return
    }

    for (const entry of fs.readdirSync(NETWORK_LOG_DIR)) {
        fs.rmSync(path.join(NETWORK_LOG_DIR, entry), { force: true })
    }
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readNestedUrl(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') {
        return undefined
    }

    const record = value as Record<string, unknown>
    const directUrl = readString(record.url)
    if (directUrl) {
        return directUrl
    }

    const request = record.request
    if (request && typeof request === 'object') {
        return readString((request as Record<string, unknown>).url)
    }

    return undefined
}

export function formatNetworkEventSummary(phase: NetworkLogPhase, event: unknown): string {
    if (!event || typeof event !== 'object') {
        return String(event)
    }

    const record = event as Record<string, unknown>
    const url =
        readNestedUrl(record.request) ??
        readNestedUrl(record.response) ??
        readString(record.url) ??
        'unknown-url'

    if (phase === 'request') {
        const request = record.request
        const method =
            request && typeof request === 'object'
                ? readString((request as Record<string, unknown>).method) ?? 'GET'
                : 'GET'
        return `${method} ${url}`
    }

    if (phase === 'response') {
        const response = record.response
        const status =
            response && typeof response === 'object'
                ? (response as Record<string, unknown>).status
                : undefined
        return `${status ?? '?'} ${url}`
    }

    const errorText = readString(record.errorText) ?? readNestedUrl(record.request) ?? url
    return `fetch failed: ${errorText}`
}

function appendNetworkLog(phase: NetworkLogPhase, event: unknown): void {
    networkLog.push({
        timestamp: new Date().toISOString(),
        phase,
        event,
    })

    const summary = redactSecretsInText(formatNetworkEventSummary(phase, event))
    const timestamp = new Date().toISOString()

    if (phase === 'error') {
        console.error(`[NETWORK ERROR] ${timestamp} - ${summary}`)
        return
    }

    console.log(`[NETWORK ${phase.toUpperCase()}] ${timestamp} - ${summary}`)
}

export async function setupNetworkLogCapture(browser: WebdriverIO.Browser): Promise<void> {
    if (!isNetworkLogEnabled()) {
        return
    }

    await browser.sessionSubscribe({
        events: [
            'network.beforeRequestSent',
            'network.responseCompleted',
            'network.fetchError',
        ],
    })

    browser.on('network.beforeRequestSent', (event: unknown) => {
        appendNetworkLog('request', event)
    })

    browser.on('network.responseCompleted', (event: unknown) => {
        appendNetworkLog('response', event)
    })

    browser.on('network.fetchError', (event: unknown) => {
        appendNetworkLog('error', event)
    })
}

export function buildNetworkLogFile(): NetworkLogFile {
    return {
        cid: workerCid,
        spec: specLabel,
        capturedAt: new Date().toISOString(),
        entries: [...networkLog],
    }
}

export function networkLogOutputPath(): string {
    return path.join(NETWORK_LOG_DIR, `${specLabel}-${workerCid}.json`)
}

export function saveNetworkLog(): string | undefined {
    if (!isNetworkLogEnabled()) {
        return undefined
    }

    fs.mkdirSync(NETWORK_LOG_DIR, { recursive: true })

    const outputPath = networkLogOutputPath()
    const json = redactSecretsInText(JSON.stringify(buildNetworkLogFile(), null, 2))
    fs.writeFileSync(outputPath, json, 'utf8')
    console.log(`[NETWORK LOG] saved ${networkLog.length} entries to ${outputPath}`)

    return outputPath
}
