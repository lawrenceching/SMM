import { registerStep } from '../lib/gherkin'
import {
    createTestFolderViaBrowser,
    joinPlatformPath,
    writeFileViaBrowser,
} from '../lib/browser-fs'
import { folder1, folder2 } from 'test/actions/import-folders'
import { importMediaLibrary } from 'test/actions/events'

interface InitializedFolder {
    folderName: string
    path: string
    type: string
}

type LibraryBaseArg = {
    /** Parent directory that becomes the imported media library root. */
    base: string
}

function requireLibraryBase(ctx: Record<string, unknown>): string {
    const payload = ctx._stepArg as LibraryBaseArg | undefined
    const base = payload?.base
    if (!base) {
        throw new Error(
            'Media library import step: missing "base". ' +
                'Pass { base } as the second argument to given(), e.g. ' +
                'given("Media library was imported with TV show folders", { base: testFolder }).',
        )
    }
    return base
}

registerStep('Media library was imported with TV show folders', async (ctx) => {
    const base = requireLibraryBase(ctx)
    const folders: InitializedFolder[] = []

    const unknownPath = await createTestFolderViaBrowser(base, {
        ...folder1,
        folderName: 'UnknownFolder',
    })
    folders.push({ folderName: 'UnknownFolder', path: unknownPath, type: 'tvshow-folder' })

    const byNamePath = await createTestFolderViaBrowser(base, folder1)
    folders.push({ folderName: folder1.folderName, path: byNamePath, type: 'tvshow-folder' })

    const byTmdbPath = await createTestFolderViaBrowser(base, {
        ...folder1,
        folderName: '{tmdbid=84666}',
    })
    folders.push({ folderName: '{tmdbid=84666}', path: byTmdbPath, type: 'tvshow-folder' })

    const byNfoPath = await createTestFolderViaBrowser(base, {
        ...folder1,
        folderName: 'FolderContainsTvShowNfo',
    })
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>84666</id>
  <tmdbid>84666</tmdbid>
</tvshow>`
    await writeFileViaBrowser(joinPlatformPath(byNfoPath, 'tvshow.nfo'), nfoXml)
    folders.push({ folderName: 'FolderContainsTvShowNfo', path: byNfoPath, type: 'tvshow-folder' })

    await importMediaLibrary({
        libraryPathInPlatformFormat: base,
        type: 'tvshow',
        traceId: 'e2e:Import Media Library:Import TV Show Library',
    })

    ctx._folders = folders
})

registerStep('Media library was imported with movie folders', async (ctx) => {
    const base = requireLibraryBase(ctx)
    const folders: InitializedFolder[] = []

    const unknownPath = await createTestFolderViaBrowser(base, {
        ...folder2,
        folderName: 'UnknownFolder',
    })
    folders.push({ folderName: 'UnknownFolder', path: unknownPath, type: 'movie-folder' })

    const byNamePath = await createTestFolderViaBrowser(base, folder2)
    folders.push({ folderName: folder2.folderName, path: byNamePath, type: 'movie-folder' })

    const byTmdbPath = await createTestFolderViaBrowser(base, {
        ...folder2,
        folderName: '{tmdbid=1539104}',
    })
    folders.push({ folderName: '{tmdbid=1539104}', path: byTmdbPath, type: 'movie-folder' })

    const byNfoPath = await createTestFolderViaBrowser(base, {
        ...folder2,
        folderName: 'FolderContainsMovieNfo',
    })
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>咒术回战 涩谷事变×死灭回游 剧场版</title>
  <id>1539104</id>
  <tmdbid>1539104</tmdbid>
</movie>`
    await writeFileViaBrowser(joinPlatformPath(byNfoPath, 'movie.nfo'), nfoXml)
    folders.push({ folderName: 'FolderContainsMovieNfo', path: byNfoPath, type: 'movie-folder' })

    await importMediaLibrary({
        libraryPathInPlatformFormat: base,
        type: 'movie',
        traceId: 'e2e:Import Media Library:Import Movie Library',
    })

    ctx._folders = folders
})
