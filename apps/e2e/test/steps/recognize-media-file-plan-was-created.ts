import { registerStep } from '../lib/gherkin'
import { Path } from '@smm/core'
import type { RecognizeMediaFilePlan } from '@smm/core/types/RecognizeMediaFilePlan.ts'
import {
    fetchHelloPathsViaBrowser,
    joinPlatformPath,
    writeFileViaBrowser,
} from 'test/lib/browser-fs'

registerStep('recognize media file plan was created for S01E01..03', async (ctx) => {
    const folder = ctx._folder as { path: string }
    const { appDataDir } = await fetchHelloPathsViaBrowser()
    const plansDir = joinPlatformPath(appDataDir, 'plans')

    const planId = crypto.randomUUID()
    const mediaFolderPathPosix = Path.posix(folder.path)

    const plan: RecognizeMediaFilePlan = {
        id: planId,
        task: 'recognize-media-file',
        status: 'pending',
        creator: 'ai',
        mediaFolderPath: mediaFolderPathPosix,
        files: [
            { season: 1, episode: 1, path: mediaFolderPathPosix + '/S01E01.mkv' },
            { season: 1, episode: 2, path: mediaFolderPathPosix + '/S01E02.mkv' },
            { season: 1, episode: 3, path: mediaFolderPathPosix + '/S01E03.mkv' },
        ],
    }

    const planFilePath = joinPlatformPath(plansDir, planId + '.plan.json')
    await writeFileViaBrowser(planFilePath, JSON.stringify(plan, null, 2))
    ctx._planFilePath = planFilePath
    console.log('Created recognize plan (v2):', planFilePath)
})
