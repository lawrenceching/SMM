import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    expectMediaMetadataViaBrowser,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    listFilesViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { getMetadataViaBrowser } from 'test/lib/metadata-http'
import StatusBar from 'test/componentobjects/StatusBar'
import { given, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'

import { testbedOs } from 'test/lib/e2e-platform'

/** Matches ImportFolderJob recognize log line for one library subfolder. */
function importFolderRecognizeLine(folderPath: string, mm: MediaMetadata | null): string {
    const name = mm?.tvShow?.name ?? mm?.movie?.name ?? 'undefined'
    const id = mm?.tvShow?.id ?? mm?.movie?.id ?? 'undefined'
    const db = (mm?.tvShow?.database ?? mm?.movie?.database ?? 'undefined').toLocaleLowerCase()
    return `Recognize ${folderPath}: ${name} (${db}Id:${id})`
}

/**
 * Import a TV show media library (common: browser / Electron / HarmonyOS).
 * Fixtures, config, and metadata assertions use browser-protocol APIs only.
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Import TV Show Library', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config) => {
                config.primaryDatabase = 'TMDB'
                config.preferMediaLanguage = 'zh-CN'
            },
            os: testbedOs,
        })

        const { default: Page } = await import('test/pageobjects/page')
        await Page.refresh()

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Import TV Show Library', async function () {
        this.timeout(6 * 60 * 1000)

        await given('Media library was imported with TV show folders', {
            base: testFolder,
        })

        const folders = getStepContext()._folders as Array<{
            folderName: string
            path: string
            type: string
        }>

        await then('unknown folder has no tvshow metadata', async () => {
            const f = folders.find((x) => x.folderName === 'UnknownFolder')!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow).toBeUndefined()
                return true
            })
        })

        await then('folder recognized by name has TMDB tvshow metadata', async () => {
            const { folder1 } = await import('test/actions/import-folders')
            const f = folders.find((x) => x.folderName === folder1.folderName)!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by tmdbid has TMDB tvshow metadata', async () => {
            const f = folders.find((x) => x.folderName === '{tmdbid=84666}')!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by NFO has TMDB tvshow metadata', async () => {
            const f = folders.find((x) => x.folderName === 'FolderContainsTvShowNfo')!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        await then('BackgroundJobsPopover ImportLibraryJob log shows import stages', async () => {
            await StatusBar.ensureBackgroundJobsPopoverOpen()
            const jobId = await StatusBar.findBackgroundJobIdContaining('Import Media Library')
                ?? await StatusBar.findBackgroundJobIdContaining('导入媒体库')
                ?? await StatusBar.findBackgroundJobIdContaining('匯入媒體庫')
            expect(jobId).not.toBeNull()

            await browser.waitUntil(
                async () => {
                    const badge = (await StatusBar.backgroundJobStatusBadge(jobId!).getText())
                        .trim()
                        .toLowerCase()
                    return badge === 'succeeded' || badge.includes('succeeded') || badge.includes('成功')
                },
                {
                    timeout: 30000,
                    interval: 500,
                    timeoutMsg: 'ImportLibraryJob did not reach succeeded in the background jobs popover',
                },
            )

            await StatusBar.openBackgroundJobLog(jobId!)
            const logText = await StatusBar.waitForLogDialogContaining(`${jobId} completed`)

            // LogDialog body must equal the ImportLibraryJob log line-for-line,
            // including each child ImportFolderJob line mirrored into the parent log.
            // Folder order matches Core listSubdirectories (same as POST /api/listFiles onlyFolders).
            const subdirs = await listFilesViaBrowser(testFolder, { onlyFolders: true })
            const folderPaths = subdirs.map((item) => item.path)
            expect(folderPaths).toHaveLength(4)

            const perFolderLines: string[] = []
            for (const folderPath of folderPaths) {
                const mm = await getMetadataViaBrowser(folderPath)
                perFolderLines.push(
                    `Started to import folder: ${folderPath}, type: tvshow`,
                    importFolderRecognizeLine(folderPath, mm),
                    `Recognize ${mm?.mediaFiles?.length ?? 0} episode files`,
                )
            }

            const expected = [
                `${jobId} started`,
                `Found ${folderPaths.length} folders to import`,
                ...perFolderLines,
                `${jobId} completed`,
            ].join('\n')
            expect(logText.replace(/\r\n/g, '\n')).toBe(expected)
        })
    })
})
