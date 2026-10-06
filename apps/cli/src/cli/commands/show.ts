import { formatShowFolder, resolveShowFolder } from '@smm/server'

export async function show(folder: string): Promise<number> {
  try {
    const resolved = await resolveShowFolder(folder)
    if (!resolved.ok) {
      console.error(resolved.error)
      return 1
    }
    for (const line of formatShowFolder(resolved.result)) {
      console.log(line)
    }
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
