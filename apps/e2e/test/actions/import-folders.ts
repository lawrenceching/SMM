import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import {
  createFolderInTestFolder as createFolderInMediaDir,
  type TestFolder,
} from '@smm/test'

export {
  type LangCode,
  type TestFolder,
  folder1,
  folder2,
  folder3,
  folder4,
  folder5,
  folder6,
  musicFolder,
  tvShowFolder,
  movieFolder,
} from '@smm/test'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

/**
 * Materialize a shared TestFolder under the e2e tmp media root.
 * Mutates `folder.path` for backward compatibility with existing e2e callers.
 */
export function createFolderInTestFolder(folder: TestFolder) {
  const created = createFolderInMediaDir(mediaDir, folder)
  console.log(
    `Created test folder "${folder.folderName}" with ${folder.files.length} files:`,
    created.path,
  )
  folder.path = created.path
  return folder
}

export async function createAndImportFolder(folder: TestFolder, traceId: string) {
  const testMediaFolder = createFolderInTestFolder(folder)

  await Menu.importMediaFolder({
    type: folder.type,
    folderPathInPlatformFormat: testMediaFolder.path!,
    traceId,
  })

  return testMediaFolder
}

export function copyFolder(sourceFolderPath: string): TestFolder {
  if (!fs.existsSync(sourceFolderPath)) {
    throw new Error(`copyFolder: source folder does not exist: ${sourceFolderPath}`)
  }

  const sourceStats = fs.statSync(sourceFolderPath)
  if (!sourceStats.isDirectory()) {
    throw new Error(`copyFolder: source path is not a directory: ${sourceFolderPath}`)
  }

  const folderName = path.basename(sourceFolderPath)
  const destinationFolderPath = path.join(mediaDir, folderName)

  fs.mkdirSync(mediaDir, { recursive: true })
  fs.rmSync(destinationFolderPath, { recursive: true, force: true })
  fs.cpSync(sourceFolderPath, destinationFolderPath, { recursive: true })

  const files = fs.readdirSync(destinationFolderPath)

  return {
    folderName,
    files,
    type: 'music',
    path: destinationFolderPath,
  }
}

export async function copyAndImportFolder(sourceFolderPath: string, traceId: string) {
  const copiedFolder = copyFolder(sourceFolderPath)

  await Menu.importMediaFolder({
    type: copiedFolder.type,
    folderPathInPlatformFormat: copiedFolder.path!,
    traceId,
  })

  return copiedFolder
}

/**
 * Rename a file inside a test media folder (under tmpMediaRoot/media).
 * @param folderName - Name of the folder (e.g. from TestFolder.folderName)
 * @param oldFileName - Current file name
 * @param newFileName - New file name
 */
export function renameFileInFolder(folderName: string, oldFileName: string, newFileName: string) {
  const folderPath = path.join(mediaDir, folderName)
  const oldPath = path.join(folderPath, oldFileName)
  const newPath = path.join(folderPath, newFileName)
  if (!fs.existsSync(oldPath)) {
    throw new Error(`renameFileInFolder: file not found: ${oldPath}`)
  }
  fs.renameSync(oldPath, newPath)
  console.log(`Renamed "${oldFileName}" to "${newFileName}" in ${folderName}`)
}
