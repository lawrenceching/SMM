import * as fs from 'node:fs'
import * as path from 'node:path'
import { registerStep } from '../lib/gherkin'
import { createFolderInTestFolder, createAndImportFolder, folder1, folder4 } from 'test/actions/import-folders'
import { importMediaFolder } from 'test/actions/events'

/**
 * Creates a TV show folder (folder1 fixture) with the given name and imports it.
 * Used when the system should recognize the show by TMDB ID embedded in the folder name,
 * or by searching the folder name against TMDB.
 */
registerStep('TV show folder "xxx" was initialized by folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = await createAndImportFolder({
        ...folder1,
        folderName: folderName ?? folder1.mediaName!,
    }, 'e2eTest:MediaFolderInitialization - TVShow TMDB')
    ctx._folder = folder
    ctx._folderName = folderName
})

/**
 * Creates a TV show folder with an unrecognizable name, imports it, then writes
 * a tvshow.nfo pointing to TMDB id 84666. The NFO is picked up asynchronously.
 */
registerStep('TV show folder "xxx" was initialized with TMDB NFO', async (ctx, args) => {
    const [folderName] = args
    const folder = await createAndImportFolder({
        ...folder1,
        folderName: folderName!,
    }, 'e2eTest:MediaFolderInitialization - TVShow NFO')
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>84666</id>
  <tmdbid>84666</tmdbid>
</tvshow>`
    fs.writeFileSync(path.join(folder.path!, 'tvshow.nfo'), nfoXml)
    ctx._folder = folder
    ctx._folderName = folderName
})

/**
 * Creates a TV show folder with a random name that the system cannot recognize,
 * then imports it. The folder remains in an "unknown" state.
 */
registerStep('TV show folder was initialized as unknown', async (ctx) => {
    const randomName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const folder = await createAndImportFolder({
        ...folder1,
        folderName: randomName,
    }, 'e2eTest:MediaFolderInitialization - TVShow Unknown')
    ctx._folder = folder
    ctx._folderName = randomName
})

/**
 * Creates a TV show folder (folder1 fixture) with a Chinese folder name and imports it
 * under the TVDB primary database. Used when testing folder-name-based search in TVDB.
 */
registerStep('TV show folder "xxx" was initialized by TVDB folder name', async (ctx, args) => {
    const [folderName] = args
    const folder = await createAndImportFolder({
        ...folder1,
        folderName: folderName!,
    }, 'TVDB TV Show Media Folder Initialization:searching folder name')
    ctx._folder = folder
    ctx._folderName = folderName
})

/**
 * Creates a TV show folder with TVDB ID embedded in the folder name (folder4 fixture:
 * "我推的孩子 {tvdbid=421069}") and imports it. The system recognizes the show directly
 * from the TVDB ID in the folder name.
 */
registerStep('TV show folder was initialized by TVDB ID', async (ctx) => {
    const folder = await createAndImportFolder(folder4, 'TVDB TV Show Media Folder Initialization:tvdbid in folder name')
    ctx._folder = folder
    ctx._folderName = folder4.folderName
})

/**
 * Creates a TV show folder with an unrecognizable name, writes a tvshow.nfo pointing
 * to TVDB id 355969, then imports the folder. The system picks up the NFO during
 * initialization.
 */
registerStep('TV show folder "xxx" was initialized with TVDB NFO', async (ctx, args) => {
    const [folderName] = args
    const folder = createFolderInTestFolder({
        ...folder1,
        folderName: folderName!,
    })
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>355969</id>
  <tvdbid>355969</tvdbid>
</tvshow>`
    fs.writeFileSync(path.join(folder.path!, 'tvshow.nfo'), nfoXml)
    await importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: folder.path!,
        traceId: 'e2eTest:MediaFolderInitialization - TVShow NFO',
    })
    ctx._folder = folder
    ctx._folderName = folderName
})
