import { getCore } from '../../core/getCore'

export async function list(): Promise<number> {
  try {
    const folders = await getCore().getFolders()
    for (const folder of folders) {
      console.log(folder)
    }
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
