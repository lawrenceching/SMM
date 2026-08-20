import type { ScrapeJob, ScrapeTaskRuntimeStatus } from 'core-app'

/** CLI display order; Core task id `thumbnails` is shown as `thumbnail`. */
export const SCRAPE_TASK_LINES = [
  { taskId: 'poster', label: 'poster' },
  { taskId: 'fanart', label: 'fanart' },
  { taskId: 'thumbnails', label: 'thumbnail' },
  { taskId: 'nfo', label: 'nfo' },
] as const

const STATUS_ICONS: Record<ScrapeTaskRuntimeStatus, string> = {
  pending: '○',
  running: '◐',
  skipped: '–',
  completed: '✓',
  failed: '✗',
}

export function scrapeStatusIcon(status: ScrapeTaskRuntimeStatus): string {
  return STATUS_ICONS[status]
}

/** Four lines: `poster ✓` … `nfo ○` */
export function formatScrapeJobTaskLines(job: ScrapeJob): string[] {
  return SCRAPE_TASK_LINES.map(({ taskId, label }) => {
    const task = job.tasks[taskId]
    return `${label} ${scrapeStatusIcon(task.status)}`
  })
}
