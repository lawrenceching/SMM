import { Mutex } from "es-toolkit"
import type { UserConfig as UserConfigData } from "@smm/core"
import type { FsPort } from "../ports/FsPort"
import { userConfigPath } from "./paths"

export const DEFAULT_USER_CONFIG: UserConfigData = {
  folders: [],
  tmdb: {},
  tvdb: {},
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "plex",
}

const mutexByPath = new Map<string, Mutex>()

function mutexFor(path: string): Mutex {
  const existing = mutexByPath.get(path)
  if (existing) return existing
  const created = new Mutex()
  mutexByPath.set(path, created)
  return created
}

/** Locked reader/writer for `{appDataDir}/smm.json`. Instances that share a path share one mutex. */
export class UserConfig {
  private readonly path: string
  private readonly mutex: Mutex

  constructor(
    private readonly fs: FsPort,
    appDataDir: string,
  ) {
    this.path = userConfigPath(appDataDir)
    this.mutex = mutexFor(this.path)
  }

  async read(): Promise<UserConfigData> {
    await this.mutex.acquire()
    try {
      return await this.loadUnlocked()
    } finally {
      this.mutex.release()
    }
  }

  async write(config: UserConfigData): Promise<void> {
    await this.mutex.acquire()
    try {
      await this.persistUnlocked(config)
    } finally {
      this.mutex.release()
    }
  }

  async update(mutator: (config: UserConfigData) => UserConfigData): Promise<UserConfigData> {
    await this.mutex.acquire()
    try {
      const current = await this.loadUnlocked()
      const next = mutator(current)
      if (next !== current) {
        await this.persistUnlocked(next)
      }
      return next
    } finally {
      this.mutex.release()
    }
  }

  private async loadUnlocked(): Promise<UserConfigData> {
    if (!(await this.fs.exists(this.path))) return { ...DEFAULT_USER_CONFIG }
    const content = await this.fs.readTextFile(this.path)
    return { ...DEFAULT_USER_CONFIG, ...(JSON.parse(content) as Partial<UserConfigData>) }
  }

  private async persistUnlocked(config: UserConfigData): Promise<void> {
    await this.fs.writeTextFile(this.path, JSON.stringify(config, null, 2))
  }
}
