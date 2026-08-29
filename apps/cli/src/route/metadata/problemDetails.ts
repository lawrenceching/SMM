import type { Context } from 'hono'
import type { ProblemDetails } from '@core/types'

export function problemJson(
  c: Context,
  status: 400 | 404 | 409 | 500,
  type: string,
  title: string,
  detail: string,
): Response {
  const body: ProblemDetails = {
    type,
    title,
    status,
    detail,
    instance: c.req.path,
  }
  return c.json(body, status, {
    'Content-Type': 'application/problem+json',
  })
}

export function metadataProblemJson(c: Context, error: unknown): Response {
  if (error instanceof Error && error.name === 'MetadataNotFoundError') {
    return problemJson(
      c,
      404,
      'urn:smm:problem:metadata-not-found',
      'Metadata not found',
      error.message,
    )
  }
  if (error instanceof Error && error.name === 'MetadataAlreadyExistsError') {
    return problemJson(
      c,
      409,
      'urn:smm:problem:metadata-already-exists',
      'Metadata already exists',
      error.message,
    )
  }
  if (error instanceof Error && error.name === 'MetadataValidationError') {
    return problemJson(
      c,
      400,
      'urn:smm:problem:metadata-validation',
      'Metadata validation failed',
      error.message,
    )
  }
  return problemJson(
    c,
    500,
    'urn:smm:problem:internal',
    'Internal server error',
    error instanceof Error ? error.message : 'Unknown error',
  )
}
