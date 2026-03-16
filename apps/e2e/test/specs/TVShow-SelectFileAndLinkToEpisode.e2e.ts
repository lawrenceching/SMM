import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import TVShowPanel from '../componentobjects/TVShowPanel.co'
import { createAndImportFolder } from '../actions/import-folders'
import { createBeforeHook, expectMediaMetadataToBe } from '../lib/testbed'
import { delay } from 'es-toolkit'

// Declared for browser.execute callbacks
declare const window: any;

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const DUMMY_FILE_NAME = 'DummyTest.mp4'

describe('TVShow - Select File and Link To Episode', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
    // Clean test.mockFilePick from localStorage
    await browser.execute(() => {
      (window as any).localStorage.removeItem('test.mockFilePick')
    })
  })

  it('links DummyTest.mp4 to S01E01 via Select File context menu and updates media metadata cache', async function () {
    this.timeout(1 * 60 * 1000)

    // 1. Create and import media folder with episode file and dummy file
    const testFolder = {
      folderName: FOLDER_NAME,
      files: ['S01E01.mp4', DUMMY_FILE_NAME],
      type: 'tvshow' as const,
    }

    const testMediaFolder = await createAndImportFolder(testFolder, 'e2eTest:TVShow SelectFileAndLinkToEpisode')
    const dummyFilePath = path.join(testMediaFolder, DUMMY_FILE_NAME)
    console.log('Created media folder with video files via importFolderToApp:', testMediaFolder)
    console.log('Files created:', fs.readdirSync(testMediaFolder))
    await delay(3 * 1000)

    // 2. Wait until page is ready
    await TVShowPanel.waitForDisplay()

    // 3. Set mock variable
    await browser.execute((dummyFilePath) => {
      (window as any).localStorage.setItem('test.mockFilePick', dummyFilePath)
    }, dummyFilePath)

    // 4. Right click the context menu
    await TVShowPanel.openAndClickContextMenuForEpisode('S01E01', 'Select File')

    // 5. Wait until the UI shows the file is selected
    await TVShowPanel.waitFor((state) =>
      state.includes(`S01E01 ${DUMMY_FILE_NAME}`),
    )

    // 6. Verify mediaMetadata cache file is updated
    await expectMediaMetadataToBe(testMediaFolder, (metadata) => {
      const mediaFiles: Array<{ absolutePath: string; seasonNumber?: number; episodeNumber?: number }> = metadata.mediaFiles ?? []
      return mediaFiles.some(
        (f) =>
          f.seasonNumber === 1 &&
          f.episodeNumber === 1 &&
          path.basename(f.absolutePath) === DUMMY_FILE_NAME,
      )
    })
  })
})

