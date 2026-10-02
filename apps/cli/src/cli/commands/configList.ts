import { getCore } from '../../core/getCore'
import { printJson } from './shared'

export async function configList(): Promise<number> {
  try {
    printJson(await getCore().getUserConfig())
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
