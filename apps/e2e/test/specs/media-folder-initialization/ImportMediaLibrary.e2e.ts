import { expect } from '@wdio/globals'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import { cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, type TestFolder, folder4, folder5, createFolderInTestFolder, folder1, folder2 } from '../../actions/import-folders'
import { setup } from '../../lib/testbed'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import ConfigDialog from 'test/componentobjects/ConfigDialog'
import Menu from 'test/componentobjects/Menu'
import { importMediaLibrary } from 'test/actions/events'
import path, { dirname } from 'node:path'
import { Path } from '@smm/core'
import fs from 'node:fs'

describe('Import Media Library', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        if (env.slowdown) {
            await delay(1000)
        }

        await ConfigDialog.setPrimaryDatabase('TMDB')
        console.log(`set primary database to TVDB in ConfigDialog`)
        if (env.slowdown) {
            await delay(1000)
        }

        await ConfigDialog.setPreferMediaLanguage('zh-CN')
        console.log(`set prefer media language to zh-CN in ConfigDialog`)
        if (env.slowdown) {
            await delay(1000)
        }

        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(1000)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    it('Import TV Show Library', async function() {
        if(env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folders: TestFolder[] = []

        const unknownFolder = createFolderInTestFolder({
            ...folder1,
            folderName: "UnknownFolder",
        })
        folders.push(unknownFolder)

        const folderRecognizedBySearchingFolderName = createFolderInTestFolder(folder1)
        folders.push(folderRecognizedBySearchingFolderName)

        const folderRecognizedByTmdbIdInFolderName = createFolderInTestFolder({
            ...folder1,
            folderName: "{tmdbid=84666}",
        })
        folders.push(folderRecognizedByTmdbIdInFolderName)

        
        const folderRecognizedByNfo = createFolderInTestFolder({
            ...folder1,
            folderName: "FolderContainsTvShowNfo",
        })
        const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>84666</id>
  <tmdbid>84666</tmdbid>
</tvshow>`
        fs.writeFileSync(path.join(folderRecognizedByNfo.path!, 'tvshow.nfo'), nfoXml)
        folders.push(folderRecognizedByNfo)

        const mediaFolder = dirname(folders[0]?.path!)!
        
        await importMediaLibrary({
            libraryPathInPlatformFormat: mediaFolder,
            type: "tvshow",
            traceId: "e2e:Import Media Library:Import TV Show Library",
        })

        await delay(30 * 1000)

        await expectMediaMetadataToBe(unknownFolder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(unknownFolder.path!))
            expect(mm.type).toBe("tvshow-folder")
            expect(mm.tvShow).toBeUndefined()
            return true;
        })

        await expectMediaMetadataToBe(folderRecognizedBySearchingFolderName.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(folderRecognizedBySearchingFolderName.path!))
            expect(mm.type).toBe("tvshow-folder")
            expect(mm.tvShow?.database).toBe("TMDB")
            return true;
        })

        await expectMediaMetadataToBe(folderRecognizedByTmdbIdInFolderName.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(folderRecognizedByTmdbIdInFolderName.path!))
            expect(mm.type).toBe("tvshow-folder")
            expect(mm.tvShow?.database).toBe("TMDB")
            return true;
        })

        await expectMediaMetadataToBe(folderRecognizedByNfo.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(folderRecognizedByNfo.path!))
            expect(mm.type).toBe("tvshow-folder")
            expect(mm.tvShow?.database).toBe("TMDB")
            return true;
        })

    })

    it('Import Movie Library', async function() {
        if(env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folders: TestFolder[] = []

        const unknownFolder = createFolderInTestFolder({
            ...folder2,
            folderName: "UnknownFolder",
        })
        folders.push(unknownFolder)

        const folderRecognizedBySearchingFolderName = createFolderInTestFolder(folder2)
        folders.push(folderRecognizedBySearchingFolderName)

        const folderRecognizedByTmdbIdInFolderName = createFolderInTestFolder({
            ...folder2,
            folderName: "{tmdbid=1539104}",
        })
        folders.push(folderRecognizedByTmdbIdInFolderName)

        
        const folderRecognizedByNfo = createFolderInTestFolder({
            ...folder2,
            folderName: "FolderContainsTvShowNfo",
        })
        const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>咒术回战 涩谷事变×死灭回游 剧场版</title>
  <id>1539104</id>
  <tmdbid>1539104</tmdbid>
</movie>`
        fs.writeFileSync(path.join(folderRecognizedByNfo.path!, 'movie.nfo'), nfoXml)
        folders.push(folderRecognizedByNfo)

        const mediaFolder = dirname(folders[0]?.path!)!
        
        await importMediaLibrary({
            libraryPathInPlatformFormat: mediaFolder,
            type: "movie",
            traceId: "e2e:Import Media Library:Import Movie Library",
        })

        await delay(30 * 1000)

        await expectMediaMetadataToBe(unknownFolder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(unknownFolder.path!))
            expect(mm.type).toBe("movie-folder")
            expect(mm.movie).toBeUndefined()
            return true;
        })

        await expectMediaMetadataToBe(folderRecognizedBySearchingFolderName.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(folderRecognizedBySearchingFolderName.path!))
            expect(mm.type).toBe("movie-folder")
            expect(mm.movie?.database).toBe("TMDB")
            return true;
        })

        await expectMediaMetadataToBe(folderRecognizedByTmdbIdInFolderName.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(folderRecognizedByTmdbIdInFolderName.path!))
            expect(mm.type).toBe("movie-folder")
            expect(mm.movie?.database).toBe("TMDB")
            return true;
        })

        await expectMediaMetadataToBe(folderRecognizedByNfo.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(folderRecognizedByNfo.path!))
            expect(mm.type).toBe("movie-folder")
            expect(mm.movie?.database).toBe("TMDB")
            return true;
        })
    })

})
