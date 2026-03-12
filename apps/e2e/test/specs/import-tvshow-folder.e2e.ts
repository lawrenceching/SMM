import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import TVShowPanel, { type TvShowEpisodeTableRow } from '../componentobjects/TVShowPanel'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { folder1, importFolderToApp } from '../actions/import-folders'

const __filename = fileURLToPath(import.meta.url)
const slowdown = process.env.SLOWDOWN === 'true'

const FOLDER_NAME = '葬送的芙莉莲'
const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('Media Folder Initialization', () => {

    before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

    beforeEach(async () => {
        console.log('Setup before each test')
    })

    afterEach(async () => {
        if (fs.existsSync(tmpMediaRoot)) {
            fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
            console.log('Removed tmp media folder:', tmpMediaRoot)
        }
    })

    it('TV Show - Folder Name', async function() {
        if(slowdown) {
            this.timeout(60 * 1000)
        }

        // Create empty folder in media directory
        const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created empty media folder:', testMediaFolder)

        if(slowdown) {
            await delay(10 * 1000)
        }

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder'
        })

        if(slowdown) {
            await delay(10 * 1000)
        }

        // Import media folder will trigger async media folder initialization, wait for it to complete
        await delay(5 * 1000)

        console.log(`Waiting for folder "${FOLDER_NAME}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolder(FOLDER_NAME, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${FOLDER_NAME}" is now displayed in sidebar`)

        // Assert immersive-input displays the folder name
        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 15000 })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === FOLDER_NAME,
            { timeout: 10000, timeoutMsg: `ImmersiveSearchbox title did not become "${FOLDER_NAME}"` }
        )
        expect(await immersiveInput.getValue()).toBe(FOLDER_NAME)

        if(slowdown) {
            await delay(10 * 1000)
        }
    })

    it('TV Show - TMDB ID in Folder Name', async function() {
        const stepTimeoutMs = 2 * 1000
        this.timeout(stepTimeoutMs * 2 + 30 * 1000)

        const expectedShowTitle = '天使降临到我身边！'

        // 1. Import folder using folder1 definition
        await importFolderToApp(folder1, 'e2eTest:Import Media Folder TMDB ID')

        // 2. Wait for folder to appear in sidebar
        await Sidebar.waitForFolder(expectedShowTitle, stepTimeoutMs)
        console.log(`Folder "${folder1.folderName}" is now displayed in sidebar`)

        // 3. Wait for immersive-input to show TMDB title
        await TVShowPanel.waitForDisplay()
        await TVShowPanel.waitForTitleToBe(expectedShowTitle)
        expect(await TVShowPanel.toString()).toEqual(`特别篇
S00E01 - - - -
第 1 季
S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)

        if(slowdown) {
            await delay(10 * 1000)
        }
    })

    it('TV Show - NFO', async function() {
        if (slowdown) {
            this.timeout(60 * 1000)
        }

        const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <id>73598</id>
  <title>爱杀宝贝</title>
</tvshow>`
        const folderName = '爱杀宝贝'
        const expectedShowTitle = '爱杀宝贝'

        // Create media folder and write tvshow.nfo
        const testMediaFolder = path.join(mediaDir, folderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        const nfoPath = path.join(testMediaFolder, 'tvshow.nfo')
        fs.writeFileSync(nfoPath, nfoXml, 'utf-8')
        console.log('Created media folder with tvshow.nfo:', testMediaFolder)

        if (slowdown) {
            await delay(10 * 1000)
        }

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder NFO'
        })

        if (slowdown) {
            await delay(10 * 1000)
        }

        console.log(`Waiting for folder "${expectedShowTitle}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolder(expectedShowTitle, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${expectedShowTitle}" is now displayed in sidebar`)

        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 15000 })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === expectedShowTitle,
            { timeout: 10000, timeoutMsg: `ImmersiveSearchbox title did not become "${expectedShowTitle}"` }
        )
        expect(await immersiveInput.getValue()).toBe(expectedShowTitle)

        if (slowdown) {
            await delay(10 * 1000)
        }
    })

    it('TV Show - Unknown', async function() {
        this.timeout(15 * 1000)

        const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const testMediaFolder = path.join(mediaDir, randomFolderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created unknown media folder:', testMediaFolder)

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder Unknown'
        })

        await delay(2 * 1000)

        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 5000 })
        const value = await immersiveInput.getValue()
        expect(value).toBe('')
    })
})
