import { Command } from 'commander'
import { getCore } from '../core/getCore'

/**
 * Run the `smm list` Commander program.
 * @param argv Full process argv (e.g. `['node', 'smm', 'list']`).
 * @returns Process exit code (0 success, 1 on error).
 */
export async function runListCli(argv: string[] = process.argv): Promise<number> {
  let exitCode = 0

  const program = new Command()
  program.name('smm').exitOverride()

  program
    .command('list')
    .description('List imported media folder paths')
    .action(async () => {
      try {
        const folders = await getCore().getFolders()
        for (const folder of folders) {
          console.log(folder)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  try {
    await program.parseAsync(argv, { from: 'node' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    exitCode = 1
  }

  return exitCode
}
