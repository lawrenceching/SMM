import { isUserConfigKey } from '@smm/core'
import { getCore } from '@smm/server'
import { parseConfigValue, printJson } from './shared'

export async function configSet(key: string, value: string): Promise<number> {
  try {
    if (!isUserConfigKey(key)) {
      console.error(`Unknown config key: ${key}`)
      return 1
    }
    const updated = await getCore().setUserConfigKey(key, parseConfigValue(value))
    printJson(updated[key] ?? null)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
