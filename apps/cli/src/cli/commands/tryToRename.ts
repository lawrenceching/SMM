import { getCore } from '../../core/getCore'
import { resolveRenameRule } from './shared'

export async function tryToRename(
  folder: string,
  options: { rule: string },
): Promise<number> {
  try {
    const rule = resolveRenameRule(options.rule)
    const plan = await getCore().tryToRenameFolder(folder, rule)
    console.log(`plan: ${plan.id}`)
    console.log(`task: ${plan.task}`)
    console.log(`status: ${plan.status}`)
    console.log(`folder: ${plan.mediaFolderPath}`)
    console.log('files:')
    if (plan.files.length === 0) {
      console.log('  (none)')
    } else {
      for (const f of plan.files) {
        console.log(`  ${f.from} → ${f.to}`)
      }
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
