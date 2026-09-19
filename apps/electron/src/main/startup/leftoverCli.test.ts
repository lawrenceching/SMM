import { describe, expect, it } from 'vitest'
import {
  cmdlineLooksLikeBinary,
  parseLinuxPpid,
  parseSmmProcessRecord,
  planLeftoverKills,
  serializeSmmProcessRecord,
  shouldKillRecordedProcess,
} from './leftoverCli'

describe('leftover CLI process record', () => {
  it('round-trips cli and electron pids', () => {
    const raw = serializeSmmProcessRecord({ cliPid: 4242, electronPid: 100 })
    expect(parseSmmProcessRecord(raw)).toEqual({ cliPid: 4242, electronPid: 100 })
  })

  it('rejects a pid that is not a positive integer', () => {
    expect(parseSmmProcessRecord('{"cliPid":0,"electronPid":-1}')).toEqual({
      cliPid: null,
      electronPid: null,
    })
    expect(parseSmmProcessRecord('not-json')).toBeNull()
  })

  it('matches a bundled binary name in proc cmdline, ps, and tasklist output', () => {
    expect(cmdlineLooksLikeBinary('/opt/SMM/resources/cli\0--port\0', 'cli')).toBe(true)
    expect(cmdlineLooksLikeBinary('/usr/bin/smm --no-sandbox', 'smm')).toBe(true)
    expect(cmdlineLooksLikeBinary('"cli.exe","4242","Console","1","10 K"', 'cli.exe')).toBe(true)
    expect(cmdlineLooksLikeBinary('/usr/bin/python3', 'cli')).toBe(false)
  })

  it('reads PPid from Linux status', () => {
    expect(parseLinuxPpid('Name:\tcli\nPPid:\t1\n')).toBe(1)
    expect(parseLinuxPpid('Name:\tcli\n')).toBeNull()
  })

  it('kills an orphaned CLI outside CI, but not a live Electron', () => {
    expect(
      shouldKillRecordedProcess({
        role: 'cli',
        pid: 50,
        currentPid: 9,
        alive: true,
        cmdline: '/opt/SMM/resources/cli',
        expectedBinaryName: 'cli',
        ci: false,
        parentPid: 1,
      }),
    ).toBe(true)
    expect(
      shouldKillRecordedProcess({
        role: 'electron',
        pid: 40,
        currentPid: 9,
        alive: true,
        cmdline: '/usr/bin/smm',
        expectedBinaryName: 'smm',
        ci: false,
        parentPid: 1,
      }),
    ).toBe(false)
  })

  it('in CI kills the previous Electron before its CLI so the CLI is not restarted', () => {
    const kills = planLeftoverKills({
      record: { cliPid: 50, electronPid: 40 },
      currentPid: 9,
      ci: true,
      cliBinaryName: 'cli',
      electronBinaryName: 'smm',
      inspect: (pid) => ({
        alive: true,
        cmdline: pid === 40 ? '/usr/lib/smm' : '/opt/SMM/resources/cli',
        parentPid: 40,
      }),
    })

    expect(kills).toEqual([40, 50])
  })

  it('does not kill the current process or a recycled pid with a different command', () => {
    const kills = planLeftoverKills({
      record: { cliPid: 9, electronPid: 77 },
      currentPid: 9,
      ci: true,
      cliBinaryName: 'cli',
      electronBinaryName: 'smm',
      inspect: () => ({
        alive: true,
        cmdline: '/usr/bin/python3',
        parentPid: 1,
      }),
    })

    expect(kills).toEqual([])
  })
})
