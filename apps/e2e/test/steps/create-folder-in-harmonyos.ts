import { registerStep } from '../lib/gherkin'
import { writeFileViaBrowser, joinPlatformPath } from '../lib/browser-fs'
import type { TestFolder } from 'test/actions/import-folders'

type CreateFolderInHarmonyOSArg = {
    base: string
    folder: TestFolder
}

/**
 * Create a media folder fixture on the HarmonyOS device via `POST /api/writeFile`.
 *
 * Usage:
 *   const base = await resolveSmmTestFolderViaBrowser()
 *   await then('Create folder in HarmonyOS', {
 *     base,
 *     folder: { ...folder1 },
 *   })
 *
 * Prefer {@link resolveSmmTestFolderViaBrowser} for `base` (app temp sandbox).
 * Do not hardcode Download/ paths — they often fail with ENOENT/EPERM on Ohos.
 *
 * Writes empty files at `{base}/{folderName}/{filename}` for each entry in
 * `folder.files` (e.g. `…/天使降临到我身边！ (2019) {tmdbid=84666}/S01E01.mkv`).
 */
registerStep('Create folder in HarmonyOS', async (ctx) => {
    const payload = ctx._stepArg as CreateFolderInHarmonyOSArg | undefined
    const base = payload?.base
    const folder = payload?.folder

    if (!base) {
        throw new Error(
            'Create folder in HarmonyOS: missing "base". ' +
                'Pass { base, folder } as the second argument to then().',
        )
    }
    if (!folder?.folderName) {
        throw new Error(
            'Create folder in HarmonyOS: missing TestFolder.folderName. ' +
                'Pass { base, folder } as the second argument to then().',
        )
    }

    const folderPath = joinPlatformPath(base, folder.folderName)

    for (const file of folder.files) {
        const filePath = file
            .split(/[/\\]/)
            .filter(Boolean)
            .reduce((acc, segment) => joinPlatformPath(acc, segment), folderPath)
        await writeFileViaBrowser(filePath, '')
    }

    folder.path = folderPath
    ctx._folder = folder
    ctx._folderName = folder.folderName

    console.log(
        `Created HarmonyOS test folder "${folder.folderName}" with ${folder.files.length} files: ${folderPath}`,
    )
})
