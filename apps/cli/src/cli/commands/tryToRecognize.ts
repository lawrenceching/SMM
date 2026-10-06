import { getCore } from '@smm/server'

export async function tryToRecognize(folder: string): Promise<number> {
  try {
    const plan = await getCore().tryToRecognizeEpisodes(folder)
    console.log(`plan: ${plan.id}`)
    console.log(`task: ${plan.task}`)
    console.log(`status: ${plan.status}`)
    console.log(`folder: ${plan.mediaFolderPath}`)
    console.log('files:')
    if (plan.files.length === 0) {
      console.log('  (none)')
    } else {
      for (const f of plan.files) {
        const ep = `S${String(f.season).padStart(2, '0')}E${String(f.episode).padStart(2, '0')}`
        console.log(`  ${ep}  ${f.path}`)
      }
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
