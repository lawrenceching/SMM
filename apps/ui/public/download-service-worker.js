/// <reference lib="webworker" />
/* global self, clients, caches, indexedDB */

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

    console.log('[SW] startDownload: fetching /api/ytdlp/download', { jobId, videoIndex: i, url: video.url })

    try {
      const res = await fetch('/api/ytdlp/download', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.url,
          folder: folder,
          args: YTDLP_DOWNLOAD_DEFAULT_ARGS,
        }),
        signal: controller.signal,
      })
      const body = await res.json()
      if (body.error) {
        console.warn('[SW] startDownload: fetch returned error', { jobId, videoIndex: i, error: body.error })
        video.status = 'failed'
        allSucceeded = false
      } else {
        console.log('[SW] startDownload: fetch succeeded', { jobId, videoIndex: i, path: body.path })
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
      const body = await res.json()
      if (body.error) {
        console.warn('[SW] startTranscribe: tencent error', { jobId, error: body.error })
      } else {
        ok = true
      }
    } else {
      const vc = data.videoCaptioner || {}
      const reqBody = { mediaPath }
      if (vc.asr !== undefined) reqBody.asr = vc.asr
      if (vc.language !== undefined) reqBody.language = vc.language
      if (vc.wordTimestamps !== undefined) reqBody.wordTimestamps = vc.wordTimestamps
      if (vc.format !== undefined) reqBody.format = vc.format
      const res = await fetch('/api/videocaptioner/transcribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      })
      const body = await res.json()
      if (body.error) {
        console.warn('[SW] startTranscribe: videocaptioner error', { jobId, error: body.error })
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
  }
})
