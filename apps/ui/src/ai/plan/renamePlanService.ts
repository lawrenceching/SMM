import type { RenameFilesPlan } from '@core/types/RenameFilesPlan'
import type { RenameValidationResult } from '@core/types'
import {
  assertMediaFolderHasMetadata,
  prepareAppendRenameEntry,
} from '@core/plan/renamePlan'
import { validateRenameOperationsSync } from '@core/validations/rename/validateRenameOperationsSync'
import { validateRenameOperationsApi } from '@/api/validateRenameOperations'
import { resolveMediaMetadataForFolderPath } from '@/ai/tools/GetMediaMetadata'
import { getPlanById } from '@/api/getPlanById'
import { updatePlan } from '@/api/updatePlan'
import { getPlanDraft, setPlanDraft } from './aiPlanDrafts'

async function validateRenameOperationsForFrontend(
  files: Array<{ from: string; to: string }>,
  folderPathInPosix: string,
): Promise<RenameValidationResult> {
  const syncResult = validateRenameOperationsSync(files, folderPathInPosix)
  if (!syncResult.isValid) {
    return syncResult
  }

  const apiResult = await validateRenameOperationsApi({
    mediaFolderPath: folderPathInPosix,
    files,
    filesystemCheck: true,
  })

  if (apiResult.error) {
    return {
      isValid: false,
      errors: [apiResult.error],
      validatedRenames: [],
    }
  }

  return apiResult.data ?? syncResult
}

export async function assertRenameMediaFolderOpened(
  mediaFolderPath: string,
): Promise<string | undefined> {
  const metadata = await resolveMediaMetadataForFolderPath(mediaFolderPath)
  return assertMediaFolderHasMetadata(!!metadata, mediaFolderPath)
}

export async function resolveRenamePlanDraft(
  planId: string,
): Promise<RenameFilesPlan | null> {
  const normalizedId = planId.trim()
  const draft = getPlanDraft(normalizedId)
  if (draft?.task === 'rename-files') {
    return draft
  }

  const resp = await getPlanById(normalizedId)
  if (resp.error || !resp.data?.plan || resp.data.plan.task !== 'rename-files') {
    return null
  }

  const plan = resp.data.plan as RenameFilesPlan
  setPlanDraft(plan)
  return plan
}

export async function appendRenameEntryWithValidation(
  planId: string,
  entry: { from: string; to: string },
): Promise<RenameFilesPlan | { error: string }> {
  const plan = await resolveRenamePlanDraft(planId)
  if (!plan) {
    return { error: `Error Reason: Task with id "${planId.trim()}" not found` }
  }

  const result = await prepareAppendRenameEntry(plan, entry, {
    validateOperations: validateRenameOperationsForFrontend,
    getMediaMetadata: async (folderPathInPosix) => {
      return (await resolveMediaMetadataForFolderPath(folderPathInPosix)) ?? null
    },
  })

  if ('error' in result) {
    return result
  }

  const resp = await updatePlan(planId.trim(), { files: result.files })
  if (resp.error || !resp.data) {
    return { error: resp.error ?? 'updatePlan failed' }
  }
  setPlanDraft(resp.data.plan as RenameFilesPlan)
  return result
}
