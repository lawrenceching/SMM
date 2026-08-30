import { Path } from '@core/path'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

export function mergeFolderPathsWithUiStatus(
  paths: string[],
  zustandFolders: UIMediaFolder[],
): UIMediaFolder[] {
  const byPosix = new Map(
    zustandFolders.map((f) => [Path.posix(f.path), f] as const),
  )
  return paths.map((p) => {
    const posix = Path.posix(p)
    const existing = byPosix.get(posix)
    const platform = Path.toPlatformPath(p)
    return {
      path: platform,
      status: existing?.status ?? 'ok',
      test: existing?.test,
      type: existing?.type,
    }
  })
}
