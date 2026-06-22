import { broadcast } from '../utils/socketIO'
import {
  RenameFilesPlanReady,
  type RenameFilesPlanReadyRequestData,
} from '@core/event-types'
import type { RenameFilesPlan } from '@core/types/RenameFilesPlan'
import {
  createEmptyRenamePlan,
  prepareAppendRenameEntry,
} from '@core/plan/renamePlan'
import { getAppDataDir } from '@/utils/config'
import path from 'path'
import { mkdir, readdir, stat } from 'fs/promises'
import { Path } from '@core/path'
import pino from 'pino'
import { findMediaMetadata } from '@/utils/mediaMetadata'
import { validateRenameOperations } from './renameFilesInBatch'

const logger = pino()

function getPlansDir(): string {
  return path.join(getAppDataDir(), 'plans')
}

export function getPlanFilePath(planId: string): string {
  const plansDir = getPlansDir()
  return path.join(plansDir, `${planId}.plan.json`)
}

async function ensurePlansDirExists(): Promise<void> {
  const plansDir = getPlansDir()
  await mkdir(plansDir, { recursive: true })
}

export async function readRenamePlanFile(planId: string): Promise<RenameFilesPlan | null> {
  const planFilePath = getPlanFilePath(planId)

  const file = Bun.file(planFilePath)
  if (!(await file.exists())) {
    return null
  }

  try {
    const content = await file.json()
    return content as RenameFilesPlan
  } catch (error) {
    throw new Error(
      `Failed to read plan file: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function writeRenamePlanFile(plan: RenameFilesPlan): Promise<void> {
  await ensurePlansDirExists()
  const planFilePath = getPlanFilePath(plan.id)
  await Bun.write(planFilePath, JSON.stringify(plan, null, 2))
}

/**
 * Begin a rename-files task. Creates a plan file and returns plan.id (taskId).
 */
export async function beginRenameFilesTaskV2(mediaFolderPath: string): Promise<string> {
  const plan = createEmptyRenamePlan(mediaFolderPath, undefined, { creator: 'ai' })
  await writeRenamePlanFile(plan)
  return plan.id
}

/**
 * Add a rename entry to an existing rename task.
 */
export async function addRenameFileToTaskV2(
  taskId: string,
  from: string,
  to: string,
): Promise<void> {
  const plan = await readRenamePlanFile(taskId)

  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`)
  }

  const result = await prepareAppendRenameEntry(plan, { from, to }, {
    validateOperations: validateRenameOperations,
    getMediaMetadata: async (folderPathInPosix) => {
      return (await findMediaMetadata(folderPathInPosix)) ?? null
    },
  })

  if ('error' in result) {
    throw new Error(result.error.replace(/^Error Reason: /, ''))
  }

  await writeRenamePlanFile(result)
}

export async function getRenameTask(taskId: string): Promise<RenameFilesPlan | undefined> {
  const plan = await readRenamePlanFile(taskId)
  return plan ?? undefined
}

/**
 * End a rename task: persist plan and broadcast RenameFilesPlanReady.
 */
export async function endRenameFilesTaskV2(taskId: string): Promise<void> {
  const plan = await readRenamePlanFile(taskId)

  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`)
  }

  const planFilePath = getPlanFilePath(plan.id)
  const planFilePathInPosix = Path.posix(planFilePath)

  const data: RenameFilesPlanReadyRequestData = {
    taskId: plan.id,
    planFilePath: planFilePathInPosix,
  }

  broadcast({
    event: RenameFilesPlanReady.event,
    data,
  })
}

export type UpdateRenamePlanStatus = 'rejected' | 'completed'

export async function updateRenamePlanStatus(
  planId: string,
  status: UpdateRenamePlanStatus,
): Promise<void> {
  const plansDir = getPlansDir()

  try {
    const stats = await stat(plansDir)
    if (!stats.isDirectory()) {
      throw new Error('Plans path exists but is not a directory')
    }
  } catch {
    throw new Error('Plans directory does not exist')
  }

  const files = await readdir(plansDir)

  for (const file of files) {
    if (!file.endsWith('.plan.json')) {
      continue
    }

    const planFilePath = path.join(plansDir, file)

    try {
      const fileContent = Bun.file(planFilePath)

      if (!(await fileContent.exists())) {
        continue
      }

      const plan = (await fileContent.json()) as RenameFilesPlan

      if (plan.task === 'rename-files' && plan.id === planId) {
        if (plan.status !== 'pending') {
          throw new Error(`Plan cannot be updated: plan has status "${plan.status}"`)
        }

        plan.status = status
        await Bun.write(planFilePath, JSON.stringify(plan, null, 2))

        logger.info({ planId, planFilePath, status }, 'Rename plan status updated successfully')
        return
      }
    } catch (error) {
      logger.warn(
        { planFilePath, error: error instanceof Error ? error.message : String(error) },
        'Failed to parse plan file, skipping',
      )
    }
  }

  throw new Error(`Plan with id "${planId}" not found`)
}

export async function getRenamePlanByPlanId(planId: string): Promise<RenameFilesPlan | null> {
  const plansDir = getPlansDir()
  try {
    const stats = await stat(plansDir)
    if (!stats.isDirectory()) {
      return null
    }
  } catch {
    return null
  }

  const files = await readdir(plansDir)
  for (const file of files) {
    if (!file.endsWith('.plan.json')) continue
    const planFilePath = path.join(plansDir, file)
    try {
      const content = (await Bun.file(planFilePath).json()) as RenameFilesPlan
      if (content.task === 'rename-files' && content.id === planId) {
        return content
      }
    } catch {
      continue
    }
  }
  return null
}

export async function getAllPendingRenamePlans(): Promise<RenameFilesPlan[]> {
  const plansDir = getPlansDir()
  const pending: RenameFilesPlan[] = []

  try {
    try {
      const stats = await stat(plansDir)
      if (!stats.isDirectory()) {
        logger.warn({ plansDir }, 'Plans path exists but is not a directory')
        return []
      }
    } catch {
      return []
    }

    const files = await readdir(plansDir)

    for (const file of files) {
      if (!file.endsWith('.plan.json')) {
        continue
      }

      const planFilePath = path.join(plansDir, file)

      try {
        const fileContent = Bun.file(planFilePath)

        if (!(await fileContent.exists())) {
          continue
        }

        const content = (await fileContent.json()) as Record<string, unknown>

        if (
          typeof content === 'object' &&
          content !== null &&
          content.task === 'rename-files' &&
          content.status === 'pending'
        ) {
          pending.push(content as unknown as RenameFilesPlan)
        }
      } catch (error) {
        logger.warn(
          { planFilePath, error: error instanceof Error ? error.message : String(error) },
          'Failed to parse plan file, skipping',
        )
      }
    }

    return pending
  } catch (error) {
    logger.error(
      { plansDir, error: error instanceof Error ? error.message : String(error) },
      'Failed to read plans directory',
    )
    return []
  }
}
