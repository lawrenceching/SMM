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

      return {
        pass,
        message: () =>
          pass
            ? `Expected folder not to contain "${fileName}", but found ${targetPath}`
            : `Expected folder to contain "${fileName}", but it was not found at ${targetPath}`,
      }
    },
  })

  isRegistered = true
}
