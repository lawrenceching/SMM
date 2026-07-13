import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { setup, cleanup, expectMediaMetadataToBe } from '../lib/testbed'
import { getMetadataDir } from '@smm/test'
import { given, when, then, resetStepContext, getStepContext } from '../lib/gherkin'
import '../steps'
import env from 'test/lib/env'
import type { UserConfig } from '@smm/core/types'
import { startConfigServer, stopConfigServer } from '../lib/configServer'
import { Path } from '@smm/core'

const CONFIG_SERVER_ADDRESS = 'http://localhost:8000'

describe('TMDB Host Failover', () => {

    before(async () => {
        await startConfigServer(CONFIG_SERVER_ADDRESS)
    })

    after(async () => {
        await stopConfigServer()
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: (config: UserConfig) => {
                config.preferMediaLanguage = 'zh-CN'
                config.applicationLanguage = 'zh-CN'
                return config
            },
            openBrowserPage: true,
            clearLocalStorage: true,
        })
        resetStepContext()
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })

    it('Failover to second TMDB host when first is unreachable', async function () {
        this.timeout(5 * 60 * 1000)

        await given('unknown TV show folder was imported')

        await then('searchbox input is empty')
        await when('searchbox input is focused')
        await browser.pause(300)
        await when('I select "TMDB" as the search database')
        await when('I select "zh-CN" as the search language')
        await when('I click the search button in the searchbox')
        await when('I search for "我推的孩子"')
        await when('I select search result with title "【我推的孩子】" and date "April 12, 2023"')

        // Wait a bit for metadata write to complete
        await browser.pause(5000)

        // Diagnostic: dump browser console errors since search
        const browserErrors = await browser.getLogs('browser').then(logs =>
            logs.filter(l => l.level === 'SEVERE').slice(-10).map(l => l.message)
        )
        console.log('[diagnostic] browser errors since select:', JSON.stringify(browserErrors))

        await then('metadata is persisted with TMDB Oshi no Ko', async () => {
            const folder = getStepContext()._folder as { path: string }
            // Diagnostic: show what's in the metadata file
            const metadataDir = await getMetadataDir()
            const mediaFolderPosix = Path.posix(folder.path)
            const safeFileName = mediaFolderPosix.replace(/[\/\\:?*|<>"]/g, '_')
            const metadataFilePath = path.join(metadataDir, `${safeFileName}.json`)
            console.log(`[diagnostic] metadata file path: ${metadataFilePath}`)
            console.log(`[diagnostic] metadata file exists: ${fs.existsSync(metadataFilePath)}`)
            if (fs.existsSync(metadataFilePath)) {
                const raw = fs.readFileSync(metadataFilePath, 'utf-8')
                console.log(`[diagnostic] metadata file content: ${raw.substring(0, 500)}`)
            }
            await expectMediaMetadataToBe(folder.path, (obj) => {
                console.log(`[diagnostic] parsed metadata: tvShow=${JSON.stringify(obj.tvShow)}, type=${obj.type}`)
                expect(obj.tvShow?.id).toBe('203737')
                expect(obj.tvShow?.name).toBe('【我推的孩子】')
                expect(obj.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        if (env.slowdown) {
            await browser.pause(10 * 1000)
        }
    })

})
