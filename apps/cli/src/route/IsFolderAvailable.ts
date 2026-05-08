import { stat } from "node:fs/promises"
import type { Hono } from "hono"
import { z } from "zod/v3"
import { logger } from "../../lib/logger"

const requestBodySchema = z.object({
  path: z.string().min(1, "path is required"),
})

export type IsFolderAvailableResponseBody = {
  available: boolean
}

/**
 * True when the path exists, is accessible, and is a directory (after symlink resolution).
 */
export async function checkFolderPathAvailable(folderPath: string): Promise<boolean> {
  try {
    const s = await stat(folderPath)
    return s.isDirectory()
  } catch {
    return false
  }
}

export function handleIsFolderAvailable(app: Hono) {
  app.post("/api/isFolderAvailable", async (c) => {
    let raw: unknown
    try {
      raw = await c.req.json()
    } catch (err) {
      logger.debug({ err }, "[IsFolderAvailable] invalid JSON")
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    const parsed = requestBodySchema.safeParse(raw)
    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      )
    }

    const available = await checkFolderPathAvailable(parsed.data.path)
    const body: IsFolderAvailableResponseBody = { available }
    return c.json(body)
  })
}
