import type { Plan } from 'core-app'

/** One summary line for `smm plan list` (human-readable). */
export function formatPlanListLine(plan: Plan): string {
  return `${plan.id}  ${plan.task}  ${plan.status}  ${plan.mediaFolderPath}`
}

/** Multi-line detail matching try-to-recognize / try-to-rename output. */
export function formatPlanDetailLines(plan: Plan): string[] {
  const lines = [
    `plan: ${plan.id}`,
    `task: ${plan.task}`,
    `status: ${plan.status}`,
    `folder: ${plan.mediaFolderPath}`,
    'files:',
  ]
  if (plan.files.length === 0) {
    lines.push('  (none)')
    return lines
  }
  if (plan.task === 'recognize-media-file') {
    for (const f of plan.files) {
      const ep = `S${String(f.season).padStart(2, '0')}E${String(f.episode).padStart(2, '0')}`
      lines.push(`  ${ep}  ${f.path}`)
    }
    return lines
  }
  for (const f of plan.files) {
    lines.push(`  ${f.from} → ${f.to}`)
  }
  return lines
}

export function planFileCount(plan: Plan): number {
  return plan.task === 'recognize-media-file' || plan.task === 'rename-files'
    ? plan.files.length
    : 0
}
