/**
 * Dedicated Web Worker: sequential /api/ytdlp/download calls, posts progress back to the main thread.
 * Message protocol matches the former download-video-sw.js Service Worker.
 */

import { YTDLP_DOWNLOAD_DEFAULT_ARGS } from '@/lib/ytdlpDownloadDefaultArgs'

export type DownloadVideoRunMessage = {
  type: 'download-video/run'
  payload: {
    jobId: string
    folder: string
    urls: string[]
  }
}

type DownloadBody = { error?: unknown; path?: string }

async function downloadOne(url: string, folder: string): Promise<DownloadBody> {
  const res = await fetch('/api/ytdlp/download', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, folder, args: YTDLP_DOWNLOAD_DEFAULT_ARGS }),
  })
  return (await res.json()) as DownloadBody
}

function postToMain(msg: object): void {
  ;(self as unknown as Worker).postMessage(msg)
}

async function runJob(jobId: string, folder: string, urls: string[]): Promise<void> {
  for (let i = 0; i < urls.length; i++) {
    postToMain({ type: 'download-video/progress', jobId, index: i })
    try {
      const body = await downloadOne(urls[i], folder)
      if (body.error) {
        postToMain({
          type: 'download-video/item-done',
          jobId,
          index: i,
          status: 'failed',
          error: String(body.error),
        })
      } else {
        postToMain({
          type: 'download-video/item-done',
          jobId,
          index: i,
          status: 'succeeded',
          path: body.path,
        })
      }
    } catch (e) {
      postToMain({
        type: 'download-video/item-done',
        jobId,
        index: i,
        status: 'failed',
        error: String(e),
      })
    }
  }
  postToMain({ type: 'download-video/job-done', jobId })
}

self.onmessage = (event: MessageEvent<DownloadVideoRunMessage>) => {
  const data = event.data
  if (!data || data.type !== 'download-video/run') {
    return
  }
  const payload = data.payload
  if (!payload) {
    return
  }
  const { jobId, folder, urls } = payload
  if (!jobId || !folder || !urls) {
    return
  }
  void runJob(jobId, folder, urls)
}
