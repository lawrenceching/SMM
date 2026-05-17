/// <reference lib="webworker" />
/* global self, clients, caches, indexedDB */

// Bump rev when `whitelisted-cmd-sw.js` changes (importScripts is cached per full URL).
const WHITELISTED_CMD_SW_REV = 4
importScripts(`/whitelisted-cmd-sw.js?rev=${WHITELISTED_CMD_SW_REV}`)
const wc = self.whitelistedCmdSw

const DB_NAME = 'DownloadTaskDatabase'
const DB_VERSION = 1
const STORE_NAME = 'jobs'
const YTDLP_DOWNLOAD_DEFAULT_ARGS = ['--write-thumbnail', '--embed-thumbnail', '--embed-metadata']
const HEARTBEAT_INTERVAL_MS = 20_000

const abortControllers = new Map()
const heartbeatTimers = new Map()

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function dbGetJob(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  })
}

function dbGetAllJobs() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  })
}

function dbPutJob(job) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(job)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
}

function dbDeleteJob(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
}

// ─── Notify clients ───────────────────────────────────────────────────────────

async function notifyClients(event, args) {
  const allClients = await clients.matchAll()
  for (const c of allClients) {
    c.postMessage({ event, ...args })
  }
}

/**
 * Read `/api/*` response as JSON. Proxies and plain-text errors (e.g. "404 Not Found") break `res.json()`
 * with "Unexpected non-whitespace character after JSON at position 4".
 */
async function parseApiResponseBody(res, logContext) {
  const meta = {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    url: res.url,
    redirected: res.redirected,
    type: res.type,
    contentType: res.headers.get('content-type') ?? undefined,
    contentLength: res.headers.get('content-length') ?? undefined,
  }
  console.log('[SW] parseApiResponseBody: response meta', { ...logContext, ...meta })

  const text = await res.text()
  const trimmed = text.trim()

  const dumpBody = !res.ok || !trimmed
  if (dumpBody) {
    console.log('[SW] parseApiResponseBody: raw body (non-OK or empty)', {
      ...logContext,
      bodyLength: text.length,
      bodyPreview: trimmed.slice(0, 800),
    })
  }

  if (!trimmed) {
    if (!res.ok) {
      console.warn('[SW] parseApiResponseBody: empty body with error HTTP status', { ...logContext, ...meta })
    }
    return {}
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (!res.ok) {
      console.warn('[SW] parseApiResponseBody: non-OK HTTP but JSON body', { ...logContext, ...meta, parsed })
    }
    return parsed
  } catch (e) {
    const preview = trimmed.slice(0, 800)
    console.warn('[SW] parseApiResponseBody: JSON.parse failed', {
      ...logContext,
      ...meta,
      parseError: e instanceof Error ? e.message : String(e),
      bodyLength: trimmed.length,
      bodyPreview: preview,
    })
    return {
      error: `Non-JSON response (HTTP ${res.status}): ${preview.slice(0, 240)}${preview.length > 240 ? '…' : ''}`,
    }
  }
}

/** Merge executeCmd correlation from SW helper result into job payload (mutates `data`). */
function mergeExecuteCmdCorrelation(data, cmdResult) {
  if (!cmdResult || typeof cmdResult !== 'object') return
  if (cmdResult.executionId) {
    data.executionId = cmdResult.executionId
  }
  if (cmdResult.logRelativePath) {
    data.logRelativePath = cmdResult.logRelativePath
  }
}

async function persistJobDataJson(job, data) {
  job.data = JSON.stringify(data)
  await dbPutJob(job)
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat(jobId, heartbeatEvent) {
  stopHeartbeat(jobId)
  const ev = heartbeatEvent || 'download:heartbeat'
  const timer = setInterval(() => {
    notifyClients(ev, { id: jobId })
  }, HEARTBEAT_INTERVAL_MS)
  heartbeatTimers.set(jobId, timer)
}

function stopHeartbeat(jobId) {
  const timer = heartbeatTimers.get(jobId)
  if (timer) {
    clearInterval(timer)
    heartbeatTimers.delete(jobId)
  }
}

// ─── handleSwReactivate ──────────────────────────────────────────────────────

async function handleSwReactivate() {
  const jobs = await dbGetAllJobs()
  for (const job of jobs) {
    if (job.status === 'running') {
      job.status = 'stopped'
      job.updatedAt = Date.now()
      if (job.data) {
        try {
          const data = JSON.parse(job.data)
          if (data.videos && Array.isArray(data.videos)) {
            for (const v of data.videos) {
              if (v.status === 'downloading') {
                v.status = 'pending'
              }
            }
          }
          job.data = JSON.stringify(data)
        } catch (_) {
          // ignore parse errors
        }
      }
      await dbPutJob(job)
    }
  }
}

// ─── Download logic ───────────────────────────────────────────────────────────

async function deleteYtdlpCookiesFileIfPresent(cookiesFile) {
  const path = typeof cookiesFile === 'string' ? cookiesFile.trim() : ''
  if (!path) return
  try {
    const resp = await fetch('/api/deleteFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!resp.ok) {
      console.warn('[SW] deleteYtdlpCookiesFile: HTTP error', { path, status: resp.status })
    }
  } catch (e) {
    console.warn('[SW] deleteYtdlpCookiesFile: failed', {
      path,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

async function startDownload(jobId) {
  console.log('[SW] startDownload called', { jobId })

  if (abortControllers.has(jobId)) {
    console.log('[SW] startDownload: already running, skipping', { jobId })
    return
  }

  const job = await dbGetJob(jobId)
  if (!job) {
    console.warn('[SW] startDownload: job not found', { jobId })
    return
  }

  const controller = new AbortController()
  abortControllers.set(jobId, controller)
  console.log('[SW] startDownload: AbortController created', { jobId })

  job.status = 'running'
  job.updatedAt = Date.now()
  await dbPutJob(job)

  startHeartbeat(jobId, 'download:heartbeat')
  await notifyClients('download:started', { id: jobId })

  let data
  try {
    data = JSON.parse(job.data || '{}')
  } catch (_) {
    data = {}
  }

  const folder = job.folder || data.folder || ''
  const videos = data.videos || []
  let allSucceeded = true

  for (let i = 0; i < videos.length; i++) {
    if (controller.signal.aborted) {
      console.log('[SW] startDownload: abort detected before fetch, breaking', { jobId, videoIndex: i })
      break
    }

    const video = videos[i]
    if (video.status === 'succeeded') {
      continue
    }

    video.status = 'downloading'
    job.data = JSON.stringify(data)
    job.updatedAt = Date.now()
    await dbPutJob(job)

    console.log('[SW] startDownload: executeCmd yt-dlp', { jobId, videoIndex: i, url: video.url })

    try {
      const executionId = self.crypto.randomUUID()
      data.executionId = executionId
      await persistJobDataJson(job, data)
      const dlArgs = wc.buildYtdlpDownloadArgs({
        url: video.url,
        folder,
        args: YTDLP_DOWNLOAD_DEFAULT_ARGS,
        format: data.ytdlpFormat,
        cookiesFile: data.ytdlpCookiesFile,
        cookiesFromBrowser: data.ytdlpCookiesFromBrowser,
      })
      const cmd = await wc.executeCmdViaFetch('yt-dlp', dlArgs, {
        signal: controller.signal,
        timeoutMs: 60 * 60 * 1000,
        executionId,
      })
      mergeExecuteCmdCorrelation(data, cmd)
      await persistJobDataJson(job, data)
      if (!cmd.success) {
        console.warn('[SW] startDownload: executeCmd error', { jobId, videoIndex: i, error: cmd.error })
        video.status = 'failed'
        allSucceeded = false
      } else {
        const path = wc.parseYtdlpDownloadStdout(cmd.stdout || '')
        console.log('[SW] startDownload: succeeded', { jobId, videoIndex: i, path })
        video.status = 'succeeded'
      }
    } catch (e) {
      console.log('[SW] startDownload: fetch threw error', {
        jobId,
        videoIndex: i,
        aborted: controller.signal.aborted,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
      })
      if (controller.signal.aborted) {
        video.status = 'pending'
        break
      }
      video.status = 'failed'
      allSucceeded = false
    }

    job.data = JSON.stringify(data)
    job.updatedAt = Date.now()
    await dbPutJob(job)
  }

  abortControllers.delete(jobId)
  stopHeartbeat(jobId)

  if (controller.signal.aborted) {
    console.log('[SW] startDownload: job stopped (aborted)', { jobId })
    job.status = 'stopped'
  } else if (allSucceeded) {
    console.log('[SW] startDownload: job succeeded', { jobId })
    job.status = 'succeeded'
    await notifyClients('download:succeeded', { id: jobId })
  } else {
    console.log('[SW] startDownload: job failed', { jobId })
    job.status = 'failed'
    await notifyClients('download:failed', { id: jobId })
  }

  await deleteYtdlpCookiesFileIfPresent(data.ytdlpCookiesFile)

  job.updatedAt = Date.now()
  await dbPutJob(job)
}

async function stopDownload(jobId) {
  console.log('[SW] stopDownload called', {
    jobId,
    hasController: abortControllers.has(jobId),
  })
  const controller = abortControllers.get(jobId)
  if (controller) {
    console.log('[SW] stopDownload: aborting controller', { jobId, alreadyAborted: controller.signal.aborted })
    controller.abort()
    abortControllers.delete(jobId)
  } else {
    console.warn('[SW] stopDownload: no AbortController found for job', { jobId })
  }

  stopHeartbeat(jobId)

  const job = await dbGetJob(jobId)
  if (job) {
    console.log('[SW] stopDownload: current job state', {
      jobId,
      status: job.status,
      videoStatuses: (() => {
        try {
          const d = JSON.parse(job.data || '{}')
          return (d.videos || []).map((v) => v.status)
        } catch { return 'parse-error' }
      })(),
    })
    job.status = 'stopped'
    job.updatedAt = Date.now()
    if (job.data) {
      try {
        const data = JSON.parse(job.data)
        if (data.videos && Array.isArray(data.videos)) {
          for (const v of data.videos) {
            if (v.status === 'downloading') {
              v.status = 'pending'
            }
          }
        }
        job.data = JSON.stringify(data)
      } catch (_) {
        // ignore parse errors
      }
    }
    await dbPutJob(job)
    console.log('[SW] stopDownload: job saved as stopped', { jobId })
  }

  await notifyClients('download:stopped', { id: jobId })
  console.log('[SW] stopDownload: notified clients', { jobId })
}

async function resumeDownload(jobId) {
  const job = await dbGetJob(jobId)
  if (!job) {
    return
  }

  if (job.data) {
    try {
      const data = JSON.parse(job.data)
      if (data.videos && Array.isArray(data.videos)) {
        for (const v of data.videos) {
          if (v.status === 'failed') {
            v.status = 'pending'
          }
        }
      }
      job.data = JSON.stringify(data)
    } catch (_) {
      // ignore parse errors
    }
  }

  job.status = 'pending'
  job.updatedAt = Date.now()
  await dbPutJob(job)

  await startDownload(jobId)
}

async function removeDownload(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }

  stopHeartbeat(jobId)

  await dbDeleteJob(jobId)

  await notifyClients('download:removed', { id: jobId, reason: 'user' })
}

// ─── Transcribe logic ─────────────────────────────────────────────────────────

async function startTranscribe(jobId) {
  console.log('[SW] startTranscribe called', { jobId })

  if (abortControllers.has(jobId)) {
    console.log('[SW] startTranscribe: already running, skipping', { jobId })
    return
  }

  const job = await dbGetJob(jobId)
  if (!job || job.type !== 'transcribe') {
    console.warn('[SW] startTranscribe: job not found or wrong type', { jobId, type: job?.type })
    return
  }

  const controller = new AbortController()
  abortControllers.set(jobId, controller)

  job.status = 'running'
  job.updatedAt = Date.now()
  await dbPutJob(job)

  startHeartbeat(jobId, 'transcribe:heartbeat')
  await notifyClients('transcribe:started', { id: jobId })

  let data
  try {
    data = JSON.parse(job.data || '{}')
  } catch (_) {
    data = {}
  }

  const mediaPath = data.mediaPathPlatform || data.mediaPath || ''
  const provider = data.provider || 'videoCaptioner'

  let ok = false
  try {
    if (provider === 'tencentAsr') {
      const ta = data.tencentAsr || {}
      const res = await fetch('/api/tencent-asr/transcribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaPath,
          baseUrl: ta.baseUrl,
          apiKey: ta.apiKey,
        }),
        signal: controller.signal,
      })
      const body = await parseApiResponseBody(res, { jobId, op: 'tencent-asr/transcribe' })
      if (body.error) {
        console.warn('[SW] startTranscribe: tencent error', { jobId, error: body.error })
      } else {
        ok = true
      }
    } else {
      const vc = data.videoCaptioner || {}
      const executionId = self.crypto.randomUUID()
      data.executionId = executionId
      await persistJobDataJson(job, data)
      const args = wc.buildVcTranscribeArgs(mediaPath, vc)
      const cmd = await wc.executeCmdViaFetch('videocaptioner', args, {
        signal: controller.signal,
        timeoutMs: 10 * 60 * 1000,
        executionId,
      })
      mergeExecuteCmdCorrelation(data, cmd)
      await persistJobDataJson(job, data)
      if (!cmd.success) {
        console.warn('[SW] startTranscribe: videocaptioner error', { jobId, error: cmd.error })
      } else {
        ok = true
      }
    }
  } catch (e) {
    console.log('[SW] startTranscribe: fetch threw', {
      jobId,
      aborted: controller.signal.aborted,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
    if (controller.signal.aborted) {
      job.status = 'stopped'
      job.progress = 0
      job.updatedAt = Date.now()
      await dbPutJob(job)
      abortControllers.delete(jobId)
      stopHeartbeat(jobId)
      await notifyClients('transcribe:stopped', { id: jobId })
      return
    }
    ok = false
  }

  abortControllers.delete(jobId)
  stopHeartbeat(jobId)

  if (controller.signal.aborted) {
    job.status = 'stopped'
  } else if (ok) {
    job.status = 'succeeded'
    job.progress = 100
    await notifyClients('transcribe:succeeded', { id: jobId })
  } else {
    job.status = 'failed'
    await notifyClients('transcribe:failed', { id: jobId })
  }

  job.updatedAt = Date.now()
  await dbPutJob(job)
}

async function stopTranscribe(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)

  const job = await dbGetJob(jobId)
  if (job && job.type === 'transcribe') {
    job.status = 'stopped'
    job.updatedAt = Date.now()
    await dbPutJob(job)
  }

  await notifyClients('transcribe:stopped', { id: jobId })
}

async function removeTranscribe(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)
  await dbDeleteJob(jobId)
  await notifyClients('transcribe:removed', { id: jobId, reason: 'user' })
}

// ─── Translate logic ─────────────────────────────────────────────────────────

async function startTranslate(jobId) {
  console.log('[SW] startTranslate called', { jobId })

  if (abortControllers.has(jobId)) {
    console.log('[SW] startTranslate: already running, skipping', { jobId })
    return
  }

  const job = await dbGetJob(jobId)
  if (!job || job.type !== 'translate') {
    console.warn('[SW] startTranslate: job not found or wrong type', { jobId, type: job?.type })
    return
  }

  const controller = new AbortController()
  abortControllers.set(jobId, controller)

  job.status = 'running'
  job.updatedAt = Date.now()
  await dbPutJob(job)

  startHeartbeat(jobId, 'translate:heartbeat')
  await notifyClients('translate:started', { id: jobId })

  let data
  try {
    data = JSON.parse(job.data || '{}')
  } catch (_) {
    data = {}
  }

  const subtitlePath = data.subtitlePathPlatform || data.subtitlePath || ''
  const translator = data.translator || 'bing'
  const targetLanguage = data.targetLanguage || ''

  let ok = false
  try {
    const executionId = self.crypto.randomUUID()
    data.executionId = executionId
    await persistJobDataJson(job, data)

    const translateBody = {
      subtitlePath,
      translator,
      targetLanguage,
    }
    if (data.reflect === true) translateBody.reflect = true
    if (data.layout) translateBody.layout = data.layout
    if (data.llm && typeof data.llm === 'object') translateBody.llm = data.llm

    const args = wc.buildVcTranslateArgs(translateBody)
    const cmd = await wc.executeCmdViaFetch('videocaptioner', args, {
      signal: controller.signal,
      timeoutMs: 10 * 60 * 1000,
      executionId,
    })
    mergeExecuteCmdCorrelation(data, cmd)
    await persistJobDataJson(job, data)
    if (!cmd.success) {
      console.warn('[SW] startTranslate: videocaptioner error', { jobId, error: cmd.error })
    } else {
      ok = true
    }
  } catch (e) {
    console.log('[SW] startTranslate: fetch threw', {
      jobId,
      aborted: controller.signal.aborted,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
    if (controller.signal.aborted) {
      job.status = 'stopped'
      job.progress = 0
      job.updatedAt = Date.now()
      await dbPutJob(job)
      abortControllers.delete(jobId)
      stopHeartbeat(jobId)
      await notifyClients('translate:stopped', { id: jobId })
      return
    }
    ok = false
  }

  abortControllers.delete(jobId)
  stopHeartbeat(jobId)

  if (controller.signal.aborted) {
    job.status = 'stopped'
  } else if (ok) {
    job.status = 'succeeded'
    job.progress = 100
    await notifyClients('translate:succeeded', { id: jobId })
  } else {
    job.status = 'failed'
    await notifyClients('translate:failed', { id: jobId })
  }

  job.updatedAt = Date.now()
  await dbPutJob(job)
}

async function stopTranslate(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)

  const job = await dbGetJob(jobId)
  if (job && job.type === 'translate') {
    job.status = 'stopped'
    job.updatedAt = Date.now()
    await dbPutJob(job)
  }

  await notifyClients('translate:stopped', { id: jobId })
}

async function removeTranslate(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)
  await dbDeleteJob(jobId)
  await notifyClients('translate:removed', { id: jobId, reason: 'user' })
}

// ─── Synthesize logic ─────────────────────────────────────────────────────────

async function startSynthesize(jobId) {
  console.log('[SW] startSynthesize called', { jobId })

  if (abortControllers.has(jobId)) {
    console.log('[SW] startSynthesize: already running, skipping', { jobId })
    return
  }

  const job = await dbGetJob(jobId)
  if (!job || job.type !== 'synthesize') {
    console.warn('[SW] startSynthesize: job not found or wrong type', { jobId, type: job?.type })
    return
  }

  const controller = new AbortController()
  abortControllers.set(jobId, controller)

  job.status = 'running'
  job.updatedAt = Date.now()
  await dbPutJob(job)

  startHeartbeat(jobId, 'synthesize:heartbeat')
  await notifyClients('synthesize:started', { id: jobId })

  let data
  try {
    data = JSON.parse(job.data || '{}')
  } catch (_) {
    data = {}
  }

  const videoPath = data.videoPathPlatform || data.videoPath || ''
  const subtitlePath = data.subtitlePathPlatform || data.subtitlePath || ''

  let ok = false
  try {
    const synthesizeBody = { videoPath, subtitlePath }
    if (data.subtitleMode) synthesizeBody.subtitleMode = data.subtitleMode
    if (data.quality) synthesizeBody.quality = data.quality
    if (data.style) synthesizeBody.style = data.style
    if (data.renderMode) synthesizeBody.renderMode = data.renderMode
    if (data.layout) synthesizeBody.layout = data.layout

    const executionId = self.crypto.randomUUID()
    data.executionId = executionId
    await persistJobDataJson(job, data)

    const args = wc.buildVcSynthesizeArgs(synthesizeBody)
    const cmd = await wc.executeCmdViaFetch('videocaptioner', args, {
      signal: controller.signal,
      timeoutMs: 60 * 60 * 1000,
      executionId,
    })
    mergeExecuteCmdCorrelation(data, cmd)
    await persistJobDataJson(job, data)
    if (!cmd.success) {
      console.warn('[SW] startSynthesize: videocaptioner error', { jobId, error: cmd.error })
    } else {
      ok = true
    }
  } catch (e) {
    console.log('[SW] startSynthesize: fetch threw', {
      jobId,
      aborted: controller.signal.aborted,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
    if (controller.signal.aborted) {
      job.status = 'stopped'
      job.progress = 0
      job.updatedAt = Date.now()
      await dbPutJob(job)
      abortControllers.delete(jobId)
      stopHeartbeat(jobId)
      await notifyClients('synthesize:stopped', { id: jobId })
      return
    }
    ok = false
  }

  abortControllers.delete(jobId)
  stopHeartbeat(jobId)

  if (controller.signal.aborted) {
    job.status = 'stopped'
  } else if (ok) {
    job.status = 'succeeded'
    job.progress = 100
    await notifyClients('synthesize:succeeded', { id: jobId })
  } else {
    job.status = 'failed'
    await notifyClients('synthesize:failed', { id: jobId })
  }

  job.updatedAt = Date.now()
  await dbPutJob(job)
}

async function stopSynthesize(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)

  const job = await dbGetJob(jobId)
  if (job && job.type === 'synthesize') {
    job.status = 'stopped'
    job.updatedAt = Date.now()
    await dbPutJob(job)
  }

  await notifyClients('synthesize:stopped', { id: jobId })
}

async function removeSynthesize(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)
  await dbDeleteJob(jobId)
  await notifyClients('synthesize:removed', { id: jobId, reason: 'user' })
}

// ─── Process (full pipeline) logic ───────────────────────────────────────────

async function startProcess(jobId) {
  console.log('[SW] startProcess called', { jobId })

  if (abortControllers.has(jobId)) {
    console.log('[SW] startProcess: already running, skipping', { jobId })
    return
  }

  const job = await dbGetJob(jobId)
  if (!job || job.type !== 'process') {
    console.warn('[SW] startProcess: job not found or wrong type', { jobId, type: job?.type })
    return
  }

  const controller = new AbortController()
  abortControllers.set(jobId, controller)

  job.status = 'running'
  job.updatedAt = Date.now()
  await dbPutJob(job)

  startHeartbeat(jobId, 'process:heartbeat')
  await notifyClients('process:started', { id: jobId })

  let data
  try {
    data = JSON.parse(job.data || '{}')
  } catch (_) {
    data = {}
  }

  const mediaPath = data.mediaPathPlatform || data.mediaPath || ''

  let ok = false
  try {
    const executionId = self.crypto.randomUUID()
    data.executionId = executionId
    await persistJobDataJson(job, data)

    const args = wc.buildVcProcessArgs(mediaPath, data)
    const cmd = await wc.executeCmdViaFetch('videocaptioner', args, {
      signal: controller.signal,
      timeoutMs: 2 * 60 * 60 * 1000,
      executionId,
    })
    mergeExecuteCmdCorrelation(data, cmd)
    await persistJobDataJson(job, data)
    if (!cmd.success) {
      console.warn('[SW] startProcess: videocaptioner error', { jobId, error: cmd.error })
    } else {
      ok = true
    }
  } catch (e) {
    console.log('[SW] startProcess: fetch threw', {
      jobId,
      aborted: controller.signal.aborted,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
    if (controller.signal.aborted) {
      job.status = 'stopped'
      job.progress = 0
      job.updatedAt = Date.now()
      await dbPutJob(job)
      abortControllers.delete(jobId)
      stopHeartbeat(jobId)
      await notifyClients('process:stopped', { id: jobId })
      return
    }
    ok = false
  }

  abortControllers.delete(jobId)
  stopHeartbeat(jobId)

  if (controller.signal.aborted) {
    job.status = 'stopped'
  } else if (ok) {
    job.status = 'succeeded'
    job.progress = 100
  } else {
    job.status = 'failed'
  }

  job.updatedAt = Date.now()
  await dbPutJob(job)

  if (controller.signal.aborted) {
    return
  }
  if (ok) {
    await notifyClients('process:succeeded', { id: jobId })
  } else {
    await notifyClients('process:failed', { id: jobId })
  }
}

async function stopProcess(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)

  const job = await dbGetJob(jobId)
  if (job && job.type === 'process') {
    job.status = 'stopped'
    job.updatedAt = Date.now()
    await dbPutJob(job)
  }

  await notifyClients('process:stopped', { id: jobId })
}

async function removeProcess(jobId) {
  const controller = abortControllers.get(jobId)
  if (controller) {
    controller.abort()
    abortControllers.delete(jobId)
  }
  stopHeartbeat(jobId)
  await dbDeleteJob(jobId)
  await notifyClients('process:removed', { id: jobId, reason: 'user' })
}

// ─── Service Worker lifecycle ─────────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([self.clients.claim(), handleSwReactivate()])
  )
})

// ─── Message handler ──────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const msg = event.data
  if (!msg || !msg.event) {
    return
  }

  console.log('[SW] message received', { event: msg.event, id: msg.id })

  switch (msg.event) {
    case 'download:start':
      if (msg.id) {
        startDownload(msg.id)
      }
      break
    case 'download:stop':
      if (msg.id) {
        stopDownload(msg.id)
      }
      break
    case 'download:resume':
      if (msg.id) {
        resumeDownload(msg.id)
      }
      break
    case 'download:remove':
      if (msg.id) {
        removeDownload(msg.id)
      }
      break
    case 'transcribe:start':
      if (msg.id) {
        startTranscribe(msg.id)
      }
      break
    case 'transcribe:stop':
      if (msg.id) {
        stopTranscribe(msg.id)
      }
      break
    case 'transcribe:remove':
      if (msg.id) {
        removeTranscribe(msg.id)
      }
      break
    case 'translate:start':
      if (msg.id) {
        startTranslate(msg.id)
      }
      break
    case 'translate:stop':
      if (msg.id) {
        stopTranslate(msg.id)
      }
      break
    case 'translate:remove':
      if (msg.id) {
        removeTranslate(msg.id)
      }
      break
    case 'synthesize:start':
      if (msg.id) {
        startSynthesize(msg.id)
      }
      break
    case 'synthesize:stop':
      if (msg.id) {
        stopSynthesize(msg.id)
      }
      break
    case 'synthesize:remove':
      if (msg.id) {
        removeSynthesize(msg.id)
      }
      break
    case 'process:start':
      if (msg.id) {
        startProcess(msg.id)
      }
      break
    case 'process:stop':
      if (msg.id) {
        stopProcess(msg.id)
      }
      break
    case 'process:remove':
      if (msg.id) {
        removeProcess(msg.id)
      }
      break
  }
})
