import { isUserConfigKey } from '@smm/core'
import { getCore } from '@smm/server'
import { printJson } from './shared'

export async function configGet(key: string): Promise<number> {
  try {
    if (!isUserConfigKey(key)) {
      console.error(`Unknown config key: ${key}`)
      return 1
    }
    const config = await getCore().getUserConfig()
    printJson(config[key] ?? null)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
