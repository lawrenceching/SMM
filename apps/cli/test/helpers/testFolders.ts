import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Mirrors `apps/e2e/test/actions/import-folders.ts` TestFolder fixtures
 * so CLI e2e uses the same folder names, files, and media ids.
 */
export interface TestFolder {
  folderName: string
  mediaName?: string
  files: string[]
  type: 'tvshow' | 'movie' | 'music'
  path?: string
}

/** Same as e2e `folder1` — TMDB id in the folder name. */
export const tvShowFolder: TestFolder = {
  folderName: '天使降临到我身边！ (2019) {tmdbid=84666}',
  mediaName: '天使降临到我身边！',
  files: [
    'S01E01.mkv',
    'S01E01.jpg',
    'S01E01.sc.ass',
    'S01E01.tc.ass',
    'S01E01.nfo',
    'S01E02.mkv',
    'S01E02.jpg',
    'S01E02.sc.ass',
    'S01E02.tc.ass',
    'S01E02.nfo',
    'S01E03.mkv',
    'S01E03.jpg',
    'S01E03.sc.ass',
    'S01E03.tc.ass',
    'S01E03.nfo',
  ],
  type: 'tvshow',
}

/** Same as e2e `folder5` — TVDB id in the folder name. */
export const movieFolder: TestFolder = {
  folderName: 'The Dark Knight {tvdbid=116}',
  mediaName: '蝙蝠侠：黑暗骑士',
  files: ['The Dark Knight [1080P].mkv'],
  type: 'movie',
}

/** Music fixture (same idea as MusicPanel template `BilibiliMusic`). */
export const musicFolder: TestFolder = {
  folderName: 'BilibiliMusic',
  files: ['01.mp3'],
  type: 'music',
}

/** Create empty placeholder files under `mediaDir/<folderName>`. */
export function createFolderInTestFolder(mediaDir: string, folder: TestFolder): TestFolder {
  const testMediaFolder = path.join(mediaDir, folder.folderName)
  fs.mkdirSync(testMediaFolder, { recursive: true })
  for (const file of folder.files) {
    fs.writeFileSync(path.join(testMediaFolder, file), '')
  }
  return { ...folder, path: testMediaFolder }
}
