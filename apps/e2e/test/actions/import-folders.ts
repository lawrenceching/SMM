import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

interface TestFolder {
    folderName: string,
    files: string[],
    type: "tvshow" | "movie" | "music"
}

export const folder1: TestFolder = {
    folderName: "天使降临到我身边！ (2019) {tmdbid=84666}",
    files: [
        "S01E01.mkv",
        "S01E01.jpg",
        "S01E01.sc.ass",
        "S01E01.tc.ass",
        "S01E01.nfo",
        "S01E02.mkv",
        "S01E02.jpg",
        "S01E02.sc.ass",
        "S01E02.tc.ass",
        "S01E02.nfo",
        "S01E03.mkv",
        "S01E03.jpg",
        "S01E03.sc.ass",
        "S01E03.tc.ass",
        "S01E03.nfo",
    ],
    type: "tvshow"
}

export const folder2: TestFolder = {
    folderName: "咒术回战 涩谷事变×死灭回游 剧场版",
    files: [
        "movie.mkv",
        "movie.nfo",
    ],
    type: "movie"
}

export function createFolderInTestFolder(folder: TestFolder) {
  const testMediaFolder = path.join(mediaDir, folder.folderName)
  fs.mkdirSync(testMediaFolder, { recursive: true })

  for (const file of folder.files) {
    const filePath = path.join(testMediaFolder, file)
    fs.writeFileSync(filePath, '')
  }

  console.log(`Created test folder "${folder.folderName}" with ${folder.files.length} files:`, testMediaFolder)

  return testMediaFolder
}

export async function importFolderToApp(folder: TestFolder, traceId: string) {
  const testMediaFolder = createFolderInTestFolder(folder)

  await Menu.importMediaFolder({
    type: folder.type,
    folderPathInPlatformFormat: testMediaFolder,
    traceId,
  })

  return testMediaFolder
}

