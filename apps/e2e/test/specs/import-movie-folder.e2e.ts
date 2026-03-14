import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const __filename = fileURLToPath(import.meta.url)
const slowdown = process.env.SLOWDOWN === 'true'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('Media Folder Initialization', () => {

    beforeEach(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

    afterEach(async () => {
        if (fs.existsSync(tmpMediaRoot)) {
            fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
            console.log('Removed tmp media folder:', tmpMediaRoot)
        }
    })

    it('Movie - Folder Name', async function() {
        if (slowdown) {
            this.timeout(60 * 1000)
        }

        const folderName = '哪吒之魔童降世'
        const testMediaFolder = path.join(mediaDir, folderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created empty media folder:', testMediaFolder)

        if (slowdown) {
            await delay(10 * 1000)
        }

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'movie',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Movie Folder Name'
        })

        if (slowdown) {
            await delay(10 * 1000)
        }

        // Import media folder will trigger async media folder initialization, wait for it to complete
        await delay(5 * 1000)

        console.log(`Waiting for folder "${folderName}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolder(folderName, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${folderName}" is now displayed in sidebar`)

        // Assert immersive-input displays the movie title
        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 15000 })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === folderName,
            { timeout: 10000, timeoutMsg: `ImmersiveMovieSearchbox title did not become "${folderName}"` }
        )
        expect(await immersiveInput.getValue()).toBe(folderName)

        if (slowdown) {
            await delay(10 * 1000)
        }
    })

    it('Movie - TMDB ID in Folder Name', async function() {
        const stepTimeoutMs = 1 * 1000
        this.timeout(stepTimeoutMs * 2 + 30 * 1000) // sidebar wait + immersive wait + buffer

        const folderNameWithTmdbId = '哪吒之魔童降世 (2019) {tmdbid=615453}'
        const expectedMovieTitle = '哪吒之魔童降世'
        const testMediaFolder = path.join(mediaDir, folderNameWithTmdbId)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created empty media folder:', testMediaFolder)

        if (slowdown) {
            await delay(10 * 1000)
        }

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'movie',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Movie Folder TMDB ID'
        })

        if (slowdown) {
            await delay(10 * 1000)
        }

        await Sidebar.waitForFolder(folderNameWithTmdbId, stepTimeoutMs)

        console.log(`Folder "${folderNameWithTmdbId}" is now displayed in sidebar`)
        // Wait for immersive-input to show TMDB title
        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 5000, timeoutMsg: `Immersive input did not become visible within 5s` })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === expectedMovieTitle,
            {
                timeout: 5000,
                timeoutMsg: `Expected immersive-input value to be "${expectedMovieTitle}", but got "${await immersiveInput.getValue()}"`
            }
        )
        expect(await immersiveInput.getValue()).toBe(expectedMovieTitle)

        if (slowdown) {
            await delay(10 * 1000)
        }
    })

    it('Movie - NFO', async function() {
        if (slowdown) {
            this.timeout(60 * 1000)
        }

        // Movie NFO uses <movie> root element (not <tvshow>)
        // Filename can be anything .nfo except tvshow.nfo
        const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>流浪地球</title>
  <tmdbid>535167</tmdbid>
</movie>`
        const folderName = '流浪地球'
        const expectedMovieTitle = '流浪地球'

        const testMediaFolder = path.join(mediaDir, folderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        const nfoPath = path.join(testMediaFolder, 'movie.nfo')
        fs.writeFileSync(nfoPath, nfoXml, 'utf-8')
        console.log('Created media folder with movie.nfo:', testMediaFolder)

        if (slowdown) {
            await delay(10 * 1000)
        }

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'movie',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Movie Folder NFO'
        })

        if (slowdown) {
            await delay(10 * 1000)
        }

        console.log(`Waiting for folder "${expectedMovieTitle}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolder(expectedMovieTitle, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${expectedMovieTitle}" is now displayed in sidebar`)

        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 15000 })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === expectedMovieTitle,
            { timeout: 10000, timeoutMsg: `ImmersiveMovieSearchbox title did not become "${expectedMovieTitle}"` }
        )
        expect(await immersiveInput.getValue()).toBe(expectedMovieTitle)

        if (slowdown) {
            await delay(10 * 1000)
        }
    })

    it('Movie - Unknown', async function() {
        this.timeout(15 * 1000)

        const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const testMediaFolder = path.join(mediaDir, randomFolderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created unknown media folder:', testMediaFolder)

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'movie',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Movie Folder Unknown'
        })

        await delay(2 * 1000)

        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 5000 })
        const value = await immersiveInput.getValue()
        expect(value).toBe('')
    })
})
