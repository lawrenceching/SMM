import * as fs from 'node:fs'
import * as path from 'node:path'

export type LangCode = 'en-US' | 'zh-CN'

/**
 * Shared test media folder fixture used by apps/e2e and apps/cli.
 * `path` is filled when the folder is materialized on disk.
 */
export interface TestFolder {
  folderName: string
  mediaName?: string
  files: string[]
  type: 'tvshow' | 'movie' | 'music'
  path?: string
  translations?: Record<string, Record<LangCode, string>>
}

/** TMDB-tagged TV show (天使降临到我身边). */
export const folder1: TestFolder = {
  folderName: '天使降临到我身边！ (2019) {tmdbid=84666}',
  mediaName: '天使降临到我身边！',
  translations: {
    title: {
      'en-US': 'WATATEN!: an Angel Flew Down to Me',
      'zh-CN': '天使降临到我身边！',
    },
  },
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

/** Movie without database id in the folder name. */
export const folder2: TestFolder = {
  folderName: '咒术回战 涩谷事变×死灭回游 剧场版',
  mediaName: '咒术回战 涩谷事变×死灭回游 剧场版',
  files: ['movie.mkv'],
  translations: {
    title: {
      'en-US': 'JUJUTSU KAISEN: Execution',
      'zh-CN': '咒术回战 涩谷事变×死灭回游 剧场版',
    },
  },
  type: 'movie',
}

/** TV show without database id in the folder name. */
export const folder3: TestFolder = {
  folderName: '我推的孩子',
  mediaName: '我推的孩子',
  files: ['S01E01.mkv'],
  type: 'tvshow',
}

/** TVDB-tagged TV show. */
export const folder4: TestFolder = {
  folderName: '我推的孩子 {tvdbid=421069}',
  mediaName: '我推的孩子',
  files: ['S01E01.mkv'],
  type: 'tvshow',
}

/** TVDB-tagged movie. */
export const folder5: TestFolder = {
  folderName: 'The Dark Knight {tvdbid=116}',
  mediaName: '蝙蝠侠：黑暗骑士',
  translations: {
    title: {
      'en-US': 'The Dark Knight',
      'zh-CN': '蝙蝠侠：黑暗骑士',
    },
  },
  files: ['The Dark Knight [1080P].mkv'],
  type: 'movie',
}

/** Same fixture as {@link folder1} (kept as a separate export for existing e2e imports). */
export const folder6: TestFolder = { ...folder1 }

/** Music panel fixture (CLI / music templates). */
export const musicFolder: TestFolder = {
  folderName: 'BilibiliMusic',
  files: ['01.mp3'],
  type: 'music',
}

/** Alias of {@link folder1} for CLI readability. */
export const tvShowFolder: TestFolder = folder1

/** Alias of {@link folder5} for CLI readability. */
export const movieFolder: TestFolder = folder5

/**
 * Create empty placeholder files under `mediaDir/<folderName>`.
 * Returns a new object with `path` set; does not mutate the input fixture.
 */
export function createFolderInTestFolder(mediaDir: string, folder: TestFolder): TestFolder {
  const testMediaFolder = path.join(mediaDir, folder.folderName)
  fs.mkdirSync(testMediaFolder, { recursive: true })
  for (const file of folder.files) {
    fs.writeFileSync(path.join(testMediaFolder, file), '')
  }
  return { ...folder, path: testMediaFolder }
}
