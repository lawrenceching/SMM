import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findEnvLocalFiles, loadEnvLocal } from './loadEnvLocal'

describe('loadEnvLocal', () => {
  it('walks up directories and lets nearer .env.local override farther ones', () => {
    const root = mkdtempSync(join(tmpdir(), 'smm-env-local-'))
    const mid = join(root, 'apps')
    const leaf = join(mid, 'cli')
    mkdirSync(leaf, { recursive: true })
    writeFileSync(join(root, '.env.local'), 'SHARED=from-root\nNEAR=from-root\n')
    writeFileSync(join(leaf, '.env.local'), 'NEAR=from-leaf\nLEAF_ONLY=cli\n')

    try {
      expect(findEnvLocalFiles(leaf)).toEqual([join(leaf, '.env.local'), join(root, '.env.local')])

      const prevShared = process.env.SHARED
      const prevNear = process.env.NEAR
      const prevLeaf = process.env.LEAF_ONLY
      delete process.env.SHARED
      delete process.env.NEAR
      delete process.env.LEAF_ONLY

      const merged = loadEnvLocal(leaf)
      expect(merged.SHARED).toBe('from-root')
      expect(merged.NEAR).toBe('from-leaf')
      expect(merged.LEAF_ONLY).toBe('cli')
      expect(process.env.SHARED).toBe('from-root')
      expect(process.env.NEAR).toBe('from-leaf')

      if (prevShared === undefined) delete process.env.SHARED
      else process.env.SHARED = prevShared
      if (prevNear === undefined) delete process.env.NEAR
      else process.env.NEAR = prevNear
      if (prevLeaf === undefined) delete process.env.LEAF_ONLY
      else process.env.LEAF_ONLY = prevLeaf
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not override keys already present in process.env', () => {
    const root = mkdtempSync(join(tmpdir(), 'smm-env-local-preset-'))
    writeFileSync(join(root, '.env.local'), 'PRESET_KEY=from-file\n')
    const prev = process.env.PRESET_KEY
    process.env.PRESET_KEY = 'already-set'
    try {
      loadEnvLocal(root)
      expect(process.env.PRESET_KEY).toBe('already-set')
    } finally {
      if (prev === undefined) delete process.env.PRESET_KEY
      else process.env.PRESET_KEY = prev
      rmSync(root, { recursive: true, force: true })
    }
  })
})
