import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

export type LangCode = 'en-US' | 'zh-CN'

export interface TestFolder {
    folderName: string,
    mediaName?: string,
    files: string[],
    type: "tvshow" | "movie" | "music"
    path?: string
    translations?: Record<string, Record<LangCode, string>>
}

export const folder1: TestFolder = {
    folderName: "天使降临到我身边！ (2019) {tmdbid=84666}",
    mediaName: '天使降临到我身边！',
    translations: {
      title: {
        'en-US': 'WATATEN!: an Angel Flew Down to Me',
        'zh-CN': '天使降临到我身边！'
      }
    },
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
    mediaName: "咒术回战 涩谷事变×死灭回游 剧场版",
    files: [
        "movie.mkv",
    ],
    translations: {
      title: {
        'en-US': 'JUJUTSU KAISEN: Execution',
        'zh-CN': '咒术回战 涩谷事变×死灭回游 剧场版'
      }
    },
    type: "movie"
}

export const folder3: TestFolder = {
    folderName: "我推的孩子",
    mediaName: "我推的孩子",
    files: [
        "S01E01.mkv",
    ],
    type: "tvshow"
}

export const folder4: TestFolder = {
  folderName: "我推的孩子 {tvdbid=421069}",
  mediaName: "我推的孩子",
  files: [
    "S01E01.mkv",
  ],
  type: "tvshow"
}

export const folder5: TestFolder = {
  folderName: "The Dark Knight {tvdbid=116}",
  mediaName: "蝙蝠侠：黑暗骑士",
  translations: {
    title: {
      'en-US': 'The Dark Knight',
      'zh-CN': '蝙蝠侠：黑暗骑士'
    }
  },
  files: [
    "The Dark Knight [1080P].mkv",
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

  folder.path = testMediaFolder
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

