import { z } from 'zod/v3'
import type { Hono } from 'hono'
import { Path } from '@core/path'
import type { RenameValidationResult } from '@core/types'
import { validateRenameOperationsSync } from '@core/validations/rename/validateRenameOperationsSync'
import { validateRenameOperations } from '../tools/renameFilesInBatch'
import { logger } from '../../lib/logger'

const requestSchema = z.object({
  mediaFolderPath: z.string().min(1, 'mediaFolderPath is required'),
  files: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
    }),
  ),
  filesystemCheck: z.boolean().optional(),
})

export interface ValidateRenameOperationsResponseBody {
  data: RenameValidationResult | null
  error: string | null
}

export async function processValidateRenameOperations(
  body: unknown,
): Promise<ValidateRenameOperationsResponseBody> {
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(', ')
    return {
      data: null,
      error: `Validation Failed: ${msg}`,
    }
  }

  const folderPathInPosix = Path.posix(parsed.data.mediaFolderPath)
  const { files, filesystemCheck = true } = parsed.data

  try {
    const syncResult = validateRenameOperationsSync(files, folderPathInPosix)
    if (!syncResult.isValid) {
      return { data: syncResult, error: null }
    }

    if (!filesystemCheck) {
      return { data: syncResult, error: null }
    }

    const fullResult = await validateRenameOperations(files, folderPathInPosix)
    return { data: fullResult, error: null }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '[validateRenameOperations] Failed',
    )
    return {
      data: null,
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function handleValidateRenameOperationsRoute(app: Hono) {
  app.post('/api/validateRenameOperations', async (c) => {
    try {
      const body = await c.req.json()
      const result = await processValidateRenameOperations(body)
      return c.json(result, 200)
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[validateRenameOperations] Route error',
      )
      return c.json(
        {
          data: null,
          error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        200,
      )
    }
  })
}
