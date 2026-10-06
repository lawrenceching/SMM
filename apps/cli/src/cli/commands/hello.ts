import { getCore } from '@smm/server'
import { formatHelloLines } from '../helloFormat'
import { printJson } from './shared'

export async function hello(options: { format?: string }): Promise<number> {
  try {
    const body = getCore().hello()
    if (options.format === 'json') {
      printJson(body)
      return 0
    }
    for (const line of formatHelloLines(body)) {
      console.log(line)
    }
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
