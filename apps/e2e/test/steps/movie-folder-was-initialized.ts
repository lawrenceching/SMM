import { registerStep } from '../lib/gherkin'
import {
    createAndImportFolderViaBrowser,
    createTestFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
    writeFileViaBrowser,
} from 'test/lib/browser-fs'
import { folder5 } from 'test/actions/import-folders'
import { importMediaFolder } from 'test/actions/events'

/**
 * Creates an empty movie folder and imports it. The system attempts to match
 * the folder name to a movie in TMDB/TVDB.
 */
registerStep('Movie folder "xxx" was created and imported', async (ctx, args) => {
    const [folderName] = args
    const folder = {
        folderName: folderName!,
        files: [] as string[],
        type: 'movie' as const,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'e2eTest:Import Movie Folder',
    )
    ctx._folder = { path: folderPath, folderName }
    ctx._folderName = folderName
})

/**
 * Creates an empty movie folder with a random name, imports it.
 * The folder remains in an "unknown" state.
 */
registerStep('Movie folder was created as unknown', async (ctx) => {
    const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const folder = {
        folderName: randomFolderName,
        files: [] as string[],
        type: 'movie' as const,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'e2eTest:Import Movie Folder Unknown',
    )
    ctx._folder = { path: folderPath, folderName: randomFolderName }
    ctx._folderName = randomFolderName
})

/**
 * Creates a movie folder with a movie.nfo file and imports it.
 */
registerStep('Movie folder "xxx" was created with movie NFO', async (ctx, args) => {
    const [folderName] = args
    const expectedMovieTitle = '流浪地球'
    const base = await resolveSmmTestFolderViaBrowser()
    const folder = {
        folderName: folderName!,
        files: [] as string[],
        type: 'movie' as const,
    }
    const folderPath = await createTestFolderViaBrowser(base, folder)
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>流浪地球</title>
  <tmdbid>535167</tmdbid>
</movie>`
    await writeFileViaBrowser(joinPlatformPath(folderPath, 'movie.nfo'), nfoXml)
    await importMediaFolder({
        type: 'movie',
        folderPathInPlatformFormat: folderPath,
        traceId: 'e2eTest:Import Movie Folder NFO',
    })
    ctx._folder = { path: folderPath, folderName: expectedMovieTitle }
    ctx._folderName = expectedMovieTitle
})

/**
 * Creates a movie folder with TMDB ID embedded in the folder name and imports it.
 */
registerStep('Movie folder "xxx" was created with TMDB ID in folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = {
        folderName: folderName!,
        files: [] as string[],
        type: 'movie' as const,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'e2eTest:Import Movie Folder TMDB ID',
    )
    ctx._folder = { path: folderPath, folderName }
    ctx._folderName = folderName
})

/**
 * Creates a movie folder from the folder5 fixture (TVDB id 116) and imports it.
 */
registerStep('Movie folder was initialized by TVDB ID', async (ctx) => {
    const folder = { ...folder5 }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'TVDB Movie Media Folder Initialization:tvdbid in folder name',
    )
    ctx._folder = { ...folder, path: folderPath }
})

/**
 * Creates a movie folder with the given folder name (no TVDB ID) and imports it.
 * The system searches by folder name in TVDB.
 */
registerStep('Movie folder "xxx" was initialized by TVDB folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = {
        ...folder5,
        folderName: folderName!,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'TVDB Movie Media Folder Initialization:searching folder name',
    )
    ctx._folder = { ...folder, path: folderPath }
})
