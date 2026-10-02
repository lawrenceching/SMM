import { getCore } from '../../core/getCore'
import { formatPlanDetailLines } from '../planFormat'
import { printJson } from './shared'

export async function planShow(
  planId: string,
  options: { format?: string },
): Promise<number> {
  try {
    const plan = await getCore().getPlan(planId)
    if (options.format === 'json') {
      printJson({ plan })
      return 0
    }
    for (const line of formatPlanDetailLines(plan)) {
      console.log(line)
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
