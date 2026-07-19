import { registerStep } from '../lib/gherkin'
import {
    createAndImportFolderViaBrowser,
    createTestFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
    writeFileViaBrowser,
} from 'test/lib/browser-fs'
import { folder1, folder4 } from 'test/actions/import-folders'
import { importMediaFolder } from 'test/actions/events'

/**
 * Creates a TV show folder (folder1 fixture) with the given name and imports it.
 * Used when the system should recognize the show by TMDB ID embedded in the folder name,
 * or by searching the folder name against TMDB.
 */
registerStep('TV show folder "xxx" was initialized by folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = {
        ...folder1,
        folderName: folderName ?? folder1.mediaName!,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'e2eTest:MediaFolderInitialization - TVShow TMDB',
    )
    ctx._folder = { ...folder, path: folderPath }
    ctx._folderName = folderName
})

/**
 * Creates a TV show folder with an unrecognizable name, writes a tvshow.nfo pointing
 * to TMDB id 84666, then imports it.
 */
registerStep('TV show folder "xxx" was initialized with TMDB NFO', async (ctx, args) => {
    const [folderName] = args
    const base = await resolveSmmTestFolderViaBrowser()
    const folder = {
        ...folder1,
        folderName: folderName!,
    }
    const folderPath = await createTestFolderViaBrowser(base, folder)
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>84666</id>
  <tmdbid>84666</tmdbid>
</tvshow>`
    await writeFileViaBrowser(joinPlatformPath(folderPath, 'tvshow.nfo'), nfoXml)
    await importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: folderPath,
        traceId: 'e2eTest:MediaFolderInitialization - TVShow NFO',
    })
    ctx._folder = { ...folder, path: folderPath }
    ctx._folderName = folderName
})

/**
 * Creates a TV show folder with a random name that the system cannot recognize,
 * then imports it. The folder remains in an "unknown" state.
 */
registerStep('TV show folder was initialized as unknown', async (ctx) => {
    const randomName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const folder = {
        ...folder1,
        folderName: randomName,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'e2eTest:MediaFolderInitialization - TVShow Unknown',
    )
    ctx._folder = { ...folder, path: folderPath }
    ctx._folderName = randomName
})

/**
 * Creates a TV show folder (folder1 fixture) with a Chinese folder name and imports it
 * under the TVDB primary database. Used when testing folder-name-based search in TVDB.
 */
registerStep('TV show folder "xxx" was initialized by TVDB folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = {
        ...folder1,
        folderName: folderName!,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'TVDB TV Show Media Folder Initialization:searching folder name',
    )
    ctx._folder = { ...folder, path: folderPath }
    ctx._folderName = folderName
})

/**
 * Creates a TV show folder with TVDB ID embedded in the folder name (folder4 fixture:
 * "我推的孩子 {tvdbid=421069}") and imports it.
 */
registerStep('TV show folder was initialized by TVDB ID', async (ctx) => {
    const folder = { ...folder4 }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'TVDB TV Show Media Folder Initialization:tvdbid in folder name',
    )
    ctx._folder = { ...folder, path: folderPath }
    ctx._folderName = folder4.folderName
})

/**
 * Creates a TV show folder with an unrecognizable name, writes a tvshow.nfo pointing
 * to TVDB id 355969, then imports the folder.
 */
registerStep('TV show folder "xxx" was initialized with TVDB NFO', async (ctx, args) => {
    const [folderName] = args
    const base = await resolveSmmTestFolderViaBrowser()
    const folder = {
        ...folder1,
        folderName: folderName!,
    }
    const folderPath = await createTestFolderViaBrowser(base, folder)
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>355969</id>
  <tvdbid>355969</tvdbid>
</tvshow>`
    await writeFileViaBrowser(joinPlatformPath(folderPath, 'tvshow.nfo'), nfoXml)
    await importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: folderPath,
        traceId: 'e2eTest:MediaFolderInitialization - TVShow NFO',
    })
    ctx._folder = { ...folder, path: folderPath }
    ctx._folderName = folderName
})
