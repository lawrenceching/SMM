import { registerStep } from '../lib/gherkin'
import { createFolderInTestFolder, folder1, folder4, type TestFolder } from 'test/actions/import-folders'
import { importMediaFolder } from 'test/actions/events'

const PREDEFINED: Record<string, TestFolder> = {
    [folder1.folderName]: folder1,
    [folder4.folderName]: folder4,
}

/**
 * Creates a media folder by matching the folder name against predefined definitions
 * in test/actions/import-folders.ts (folder1, folder4, etc.) and imports it.
 * The folder name should contain `{tmdbid=...}` or `{tvdbid=...}` to trigger recognition.
 */
registerStep('Import media folder "xxx"', async (ctx, args) => {
    const [folderName] = args
    const def = PREDEFINED[folderName!]
    if (!def) {
        throw new Error(
            `No predefined folder found for "${folderName}". ` +
            `Available: ${Object.keys(PREDEFINED).join(', ')}`
        )
    }
    const folder = createFolderInTestFolder(def)
    await importMediaFolder({
        type: def.type,
        folderPathInPlatformFormat: folder.path!,
        traceId: 'e2eTest:ImportMediaFolder',
    })
    ctx._folder = folder
    ctx._folderName = folderName
})

/**
 * Creates and imports a media folder from a custom TestFolder definition.
 * Set `ctx._importFolderDef` to a TestFolder before calling this step.
 *
 * Usage:
 *   getStepContext()._importFolderDef = { ...folder1, folderName: 'My Folder {tvdbid=123}' }
 *   await when('Import media folder')
 */
registerStep('Import media folder', async (ctx) => {
    const def = ctx._importFolderDef as TestFolder | undefined
    if (!def) {
        throw new Error(
            'No folder definition found. ' +
            'Set ctx._importFolderDef to a TestFolder before calling this step.'
        )
    }
    const folder = createFolderInTestFolder(def)
    await importMediaFolder({
        type: def.type,
        folderPathInPlatformFormat: folder.path!,
        traceId: 'e2eTest:ImportMediaFolder',
    })
    ctx._folder = folder
    ctx._folderName = def.folderName
})
