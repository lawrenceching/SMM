import { Mutex } from "es-toolkit"
import type { UserConfig as UserConfigData } from "@smm/types"
import type { FsPort } from "../ports/FsPort"
import { userConfigPath } from "./paths"
import { DEFAULT_USER_CONFIG, isUserConfigKey } from "./userConfigDefaults"
import { validateUserConfig, validateUserConfigValue } from "./userConfigValidation"

export { DEFAULT_USER_CONFIG, USER_CONFIG_KEYS, isUserConfigKey } from "./userConfigDefaults"

const mutexByPath = new Map<string, Mutex>()

function mutexFor(path: string): Mutex {
  const existing = mutexByPath.get(path)
  if (existing) return existing
  const created = new Mutex()
  mutexByPath.set(path, created)
  return created
}

/** Locked reader/writer for `{appDataDir}/smm.json`. Instances that share a path share one mutex. */
export class UserConfigHelper {
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
    const validated = validateUserConfig(config)
    await this.mutex.acquire()
    try {
      await this.persistUnlocked(validated)
    } finally {
      this.mutex.release()
    }
  }

  /** Reads a single field under the file lock. */
  async getKey<K extends keyof UserConfigData>(key: K): Promise<UserConfigData[K]> {
    const config = await this.read()
    return config[key]
  }

  /** Validates and persists one field; returns the updated config. */
  async setKey<K extends keyof UserConfigData>(
    key: K,
    value: unknown,
  ): Promise<UserConfigData> {
    if (!isUserConfigKey(key)) {
      throw new Error(`Unknown config key: ${String(key)}`)
    }
    const validated = validateUserConfigValue(key, value)
    return this.update((config) => ({ ...config, [key]: validated }))
  }

  async getFolders(): Promise<string[]> {
    return this.getKey("folders")
  }

  async setFolders(folders: string[]): Promise<UserConfigData> {
    return this.setKey("folders", folders)
  }

  async addFolder(folderPath: string): Promise<UserConfigData> {
    if (typeof folderPath !== "string" || !folderPath.trim()) {
      throw new Error("folder path must be a non-empty string")
    }
    return this.update((config) => ({
      ...config,
      folders: [...new Set([...config.folders, folderPath])],
    }))
  }

  async update(mutator: (config: UserConfigData) => UserConfigData): Promise<UserConfigData> {
    await this.mutex.acquire()
    try {
      const current = await this.loadUnlocked()
      const next = mutator(current)
      if (next === current) {
        return current
      }
      const validated = validateUserConfig(next)
      await this.persistUnlocked(validated)
      return validated
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
