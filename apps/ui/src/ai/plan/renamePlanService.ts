import type { RenameFilesPlan } from '@core/types/RenameFilesPlan'
import type { RenameValidationResult } from '@core/types'
import {
  assertMediaFolderHasMetadata,
  prepareAppendRenameEntry,
} from '@core/plan/renamePlan'
import { validateRenameOperationsSync } from '@core/validations/rename/validateRenameOperationsSync'
import { validateRenameOperationsApi } from '@/api/validateRenameOperations'
import { resolveMediaMetadataForFolderPath } from '@/ai/tools/GetMediaMetadata'
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

export async function appendRenameEntryWithValidation(
  planId: string,
  entry: { from: string; to: string },
): Promise<RenameFilesPlan | { error: string }> {
  const plan = getPlanDraft(planId)
  if (!plan || plan.task !== 'rename-files') {
    return { error: `Error Reason: Task with id "${planId}" not found` }
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

  const resp = await updatePlan(planId, { files: result.files })
  if (resp.error || !resp.data) {
    return { error: resp.error ?? 'updatePlan failed' }
  }
  setPlanDraft(resp.data.plan as RenameFilesPlan)
  return result
}
