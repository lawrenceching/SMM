import { describe, expect, it } from 'vitest'
import { smm } from './helpers/smm'

describe('smm --help', () => {
  it.each(['--help', '-h'] as const)('prints usage and commands for %s', async (flag) => {
    const result = await smm([flag])
    expect(result.code, result.stderr || result.stdout).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/Usage:\s+smm/)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('add')
    expect(result.stdout).toContain('scrape')
  })
})
