import { execFileSync } from 'child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

const SMM_PROCESS_RECORD_FILENAME = 'smm-process.json'

export interface SmmProcessRecord {
  cliPid: number | null
  electronPid: number | null
}

export interface ProcessInspection {
  alive: boolean
  cmdline: string | null
  parentPid: number | null
}

export function smmProcessRecordPath(tmpDir: string): string {
  return join(tmpDir, SMM_PROCESS_RECORD_FILENAME)
}

export function serializeSmmProcessRecord(record: SmmProcessRecord): string {
  return JSON.stringify(record)
}

function positivePid(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null
  }
  return value
}

export function parseSmmProcessRecord(raw: string): SmmProcessRecord | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return null
    }
    const record = value as { cliPid?: unknown; electronPid?: unknown }
    return {
      cliPid: positivePid(record.cliPid),
      electronPid: positivePid(record.electronPid),
    }
  } catch {
    return null
  }
}

/**
 * Match a bundled binary name against Linux `/proc` cmdline, `ps` output, or `tasklist`.
 */
export function cmdlineLooksLikeBinary(cmdline: string, binaryName: string): boolean {
  const normalized = cmdline.replace(/\\/g, '/')
  const fragments = normalized.split(/[\0\n]/)
  return fragments.some((fragment) => {
    const tokens = fragment.split('/')
    const leaf = tokens[tokens.length - 1] ?? ''
    const name = leaf.trim().replace(/"/g, '').split(/[\s,]/)[0] ?? ''
    return name === binaryName
  })
}

export function parseLinuxPpid(statusText: string): number | null {
  const line = statusText.split('\n').find((entry) => entry.startsWith('PPid:'))
  if (!line) {
    return null
  }
  const pid = Number.parseInt(line.slice('PPid:'.length).trim(), 10)
  if (!Number.isInteger(pid) || pid < 0) {
    return null
  }
  return pid
}

/**
 * A leftover CLI from a killed Electron process keeps the HTTP port.
 * In CI, also stop the previous Electron so it cannot restart that CLI.
 * Outside CI, only an orphaned CLI (reparented to init) is stopped.
 */
export function shouldKillRecordedProcess(input: {
  role: 'cli' | 'electron'
  pid: number | null
  currentPid: number
  alive: boolean
  cmdline: string | null
  expectedBinaryName: string
  ci: boolean
  parentPid: number | null
}): boolean {
  if (input.pid === null || input.pid === input.currentPid || !input.alive) {
    return false
  }
  if (input.cmdline === null || !cmdlineLooksLikeBinary(input.cmdline, input.expectedBinaryName)) {
    return false
  }
  if (input.ci) {
    return true
  }
  return input.role === 'cli' && input.parentPid === 1
}

export function planLeftoverKills(input: {
  record: SmmProcessRecord | null
  currentPid: number
  ci: boolean
  cliBinaryName: string
  electronBinaryName: string
  inspect: (pid: number) => ProcessInspection
}): number[] {
  if (input.record === null) {
    return []
  }

  const kills: number[] = []
  const consider = (
    role: 'cli' | 'electron',
    pid: number | null,
    expectedBinaryName: string,
  ): void => {
    if (pid === null || kills.includes(pid)) {
      return
    }
    const inspection = input.inspect(pid)
    if (
      shouldKillRecordedProcess({
        role,
        pid,
        currentPid: input.currentPid,
        alive: inspection.alive,
        cmdline: inspection.cmdline,
        expectedBinaryName,
        ci: input.ci,
        parentPid: inspection.parentPid,
      })
    ) {
      kills.push(pid)
    }
  }

  consider('electron', input.record.electronPid, input.electronBinaryName)
  consider('cli', input.record.cliPid, input.cliBinaryName)
  return kills
}

function isAlivePid(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function readCmdline(pid: number, platform: NodeJS.Platform): string | null {
  try {
    if (platform === 'linux') {
      return readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    }
    if (platform === 'darwin') {
      return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
    }
    if (platform === 'win32') {
      return execFileSync(
        'tasklist',
        ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
        { encoding: 'utf8' },
      )
    }
  } catch {
    return null
  }
  return null
}

function readParentPid(pid: number, platform: NodeJS.Platform): number | null {
  try {
    if (platform === 'linux') {
      return parseLinuxPpid(readFileSync(`/proc/${pid}/status`, 'utf8'))
    }
    if (platform === 'darwin') {
      const text = execFileSync('ps', ['-p', String(pid), '-o', 'ppid='], { encoding: 'utf8' })
      const parent = Number.parseInt(text.trim(), 10)
      return Number.isInteger(parent) && parent >= 0 ? parent : null
    }
  } catch {
    return null
  }
  return null
}

function killProcessTree(pid: number, platform: NodeJS.Platform): void {
  if (platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL')
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        return
      }
    }
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      console.warn(`[SMM] failed to kill leftover pid ${pid}:`, error)
    }
  }
}

function waitForPidExit(pid: number, timeoutMs: number): Promise<void> {
  const started = Date.now()
  return new Promise((resolve) => {
    const tick = (): void => {
      if (!isAlivePid(pid) || Date.now() - started >= timeoutMs) {
        resolve()
        return
      }
      setTimeout(tick, 50)
    }
    tick()
  })
}

export function writeSmmProcessRecord(pidFilePath: string, record: SmmProcessRecord): void {
  writeFileSync(pidFilePath, serializeSmmProcessRecord(record))
}

export function clearSmmProcessRecord(pidFilePath: string): void {
  try {
    unlinkSync(pidFilePath)
  } catch {
    // Already gone, or the next launch will ignore a stale pid that is not alive.
  }
}

/**
 * Stop a CLI (and, in CI, its Electron parent) left behind when the previous
 * process was killed before `before-quit` could run.
 */
export async function stopLeftoverSmmProcesses(options: {
  pidFilePath: string
  currentPid: number
  ci: boolean
  platform: NodeJS.Platform
  cliBinaryName: string
  electronBinaryName: string
}): Promise<number[]> {
  let raw: string
  try {
    raw = readFileSync(options.pidFilePath, 'utf8')
  } catch {
    console.error(`[SMM] leftover: no process record at ${options.pidFilePath}`)
    return []
  }

  const record = parseSmmProcessRecord(raw)
  console.error(
    `[SMM] leftover: record=${JSON.stringify(record)} currentPid=${options.currentPid} ci=${options.ci}`,
  )

  const kills = planLeftoverKills({
    record,
    currentPid: options.currentPid,
    ci: options.ci,
    cliBinaryName: options.cliBinaryName,
    electronBinaryName: options.electronBinaryName,
    inspect: (pid) => ({
      alive: isAlivePid(pid),
      cmdline: readCmdline(pid, options.platform),
      parentPid: readParentPid(pid, options.platform),
    }),
  })

  for (const pid of kills) {
    const inspection = {
      alive: isAlivePid(pid),
      cmdline: readCmdline(pid, options.platform),
      parentPid: readParentPid(pid, options.platform),
    }
    console.error(
      `[SMM] stopping leftover process pid=${pid} alive=${inspection.alive} ` +
        `ppid=${inspection.parentPid} cmdline=${JSON.stringify(inspection.cmdline)}`,
    )
    killProcessTree(pid, options.platform)
    await waitForPidExit(pid, 2_000)
    console.error(`[SMM] leftover pid=${pid} after-kill alive=${isAlivePid(pid)}`)
  }

  if (kills.length === 0 && record !== null) {
    console.error('[SMM] leftover: record present but no pids selected for kill')
  }

  return kills
}
