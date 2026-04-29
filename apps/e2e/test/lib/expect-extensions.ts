import fs from "node:fs"
import path from "node:path"
import { expect } from "@wdio/globals"

interface FolderLike {
  path?: string
  folderName?: string
}

let isRegistered = false

export function registerExpectExtensions() {
  if (isRegistered) return

  expect.extend({
    toContainFile(received: FolderLike, fileName: string) {
      const folderPath = received?.path
      if (!folderPath) {
        return {
          pass: false,
          message: () =>
            "Expected folder.path to be defined before checking file existence.",
        }
      }

      const targetPath = path.join(folderPath, fileName)
      const pass = fs.existsSync(targetPath)
      const maxFilesInMessage = 50

      const folderEntries = (() => {
        try {
          return fs
            .readdirSync(folderPath, { withFileTypes: true })
            .map((entry) => `${entry.isDirectory() ? "[DIR] " : "[FILE] "}${entry.name}`)
            .sort((a, b) => a.localeCompare(b))
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          return [`<failed to read directory: ${reason}>`]
        }
      })()

      const shownEntries = folderEntries.slice(0, maxFilesInMessage)
      const remainingCount = Math.max(folderEntries.length - shownEntries.length, 0)
      const folderListText =
        shownEntries.length > 0
          ? shownEntries.join("\n")
          : "<empty directory>"
      const truncatedHint =
        remainingCount > 0
          ? `\n... and ${remainingCount} more entries`
          : ""

      return {
        pass,
        message: () =>
          pass
            ? `Expected folder not to contain "${fileName}", but found ${targetPath}`
            : `Expected folder to contain "${fileName}", but it was not found at ${targetPath}\n\nDirectory listing (${folderPath}):\n${folderListText}${truncatedHint}`,
      }
    },
  })

  isRegistered = true
}
