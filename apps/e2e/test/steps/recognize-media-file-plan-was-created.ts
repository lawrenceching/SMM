import * as fs from 'node:fs'
import * as path from 'node:path'
import { registerStep } from '../lib/gherkin'
import { Path } from '@smm/core'
import { getPlanDir } from '@smm/test'
import type { RecognizeMediaFilePlan } from '@smm/core/types/RecognizeMediaFilePlan.ts'

registerStep('recognize media file plan was created for S01E01..03', async (ctx) => {
    const folder = ctx._folder as { path: string }
    const plansDir = await getPlanDir()
    fs.mkdirSync(plansDir, { recursive: true })

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

    const planFilePath = path.join(plansDir, planId + '.plan.json')
    fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2), 'utf-8')
    ctx._planFilePath = planFilePath
    console.log('Created recognize plan:', planFilePath)
})
