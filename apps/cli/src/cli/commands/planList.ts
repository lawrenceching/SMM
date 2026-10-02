import { getCore } from '../../core/getCore'
import { formatPlanListLine } from '../planFormat'
import { printJson } from './shared'

export async function planList(
  folder: string | undefined,
  options: { all?: boolean; format?: string },
): Promise<number> {
  try {
    const plans = await getCore().listPlans({
      mediaFolderPath: folder,
      all: Boolean(options.all),
    })
    if (options.format === 'json') {
      printJson({ plans })
      return 0
    }
    for (const plan of plans) {
      console.log(formatPlanListLine(plan))
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
