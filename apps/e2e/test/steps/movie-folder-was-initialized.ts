import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { registerStep } from '../lib/gherkin'
import { createFolderInTestFolder, createAndImportFolder, folder5 } from 'test/actions/import-folders'
import { importMediaFolder } from 'test/actions/events'
import Menu from '../componentobjects/Menu'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

/**
 * Creates an empty movie folder and imports it. The system attempts to match
 * the folder name to a movie in TMDB/TVDB.
 */
registerStep('Movie folder "xxx" was created and imported', async (ctx, args) => {
    const [folderName] = args
    const testMediaFolder = path.join(mediaDir, folderName!)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    await Menu.importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: testMediaFolder,
        traceId: 'e2eTest:Import Movie Folder',
    })
    ctx._folder = { path: testMediaFolder, folderName: folderName }
    ctx._folderName = folderName
})

/**
 * Creates an empty movie folder with a random name, imports it.
 * The folder remains in an "unknown" state.
 */
registerStep('Movie folder was created as unknown', async (ctx) => {
    const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const testMediaFolder = path.join(mediaDir, randomFolderName)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    await Menu.importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: testMediaFolder,
        traceId: 'e2eTest:Import Movie Folder Unknown',
    })
    ctx._folder = { path: testMediaFolder, folderName: randomFolderName }
    ctx._folderName = randomFolderName
})

/**
 * Creates a movie folder with a movie.nfo file and imports it.
 */
registerStep('Movie folder "xxx" was created with movie NFO', async (ctx, args) => {
    const [folderName] = args
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>流浪地球</title>
  <tmdbid>535167</tmdbid>
</movie>`
    const expectedMovieTitle = '流浪地球'
    const testMediaFolder = path.join(mediaDir, folderName!)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    const nfoPath = path.join(testMediaFolder, 'movie.nfo')
    fs.writeFileSync(nfoPath, nfoXml, 'utf-8')
    await Menu.importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: testMediaFolder,
        traceId: 'e2eTest:Import Movie Folder NFO',
    })
    ctx._folder = { path: testMediaFolder, folderName: expectedMovieTitle }
    ctx._folderName = expectedMovieTitle
})

/**
 * Creates a movie folder with TMDB ID embedded in the folder name and imports it.
 * The system recognizes the movie directly from the TMDB ID.
 */
registerStep('Movie folder "xxx" was created with TMDB ID in folder name', async (ctx, args) => {
    const [folderName] = args
    const testMediaFolder = path.join(mediaDir, folderName!)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    await Menu.importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: testMediaFolder,
        traceId: 'e2eTest:Import Movie Folder TMDB ID',
    })
    ctx._folder = { path: testMediaFolder, folderName: folderName }
    ctx._folderName = folderName
})

/**
 * Creates a movie folder from the folder5 fixture (TVDB id 116) and imports it.
 * The system recognizes the movie from the TVDB ID in the folder name.
 */
registerStep('Movie folder was initialized by TVDB ID', async (ctx) => {
    const folder = createFolderInTestFolder(folder5)
    await Menu.importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: folder.path!,
        traceId: 'TVDB Movie Media Folder Initialization:tvdbid in folder name',
    })
    ctx._folder = folder
})

/**
 * Creates a movie folder with the given folder name (no TVDB ID) and imports it.
 * The system searches by folder name in TVDB.
 */
registerStep('Movie folder "xxx" was initialized by TVDB folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = createFolderInTestFolder({
        ...folder5,
        folderName: folderName!,
    })
    await Menu.importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: folder.path!,
        traceId: 'TVDB Movie Media Folder Initialization:searching folder name',
    })
    ctx._folder = folder
})
