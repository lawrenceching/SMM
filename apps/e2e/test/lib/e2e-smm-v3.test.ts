import { afterEach, describe, expect, test } from 'bun:test'
import { isE2eSmmV3Enabled, localStorageEntriesAfterClear } from './e2e-smm-v3.ts'

describe('isE2eSmmV3Enabled', () => {
  const prev = process.env.E2E_SMM_V3

  afterEach(() => {
    if (prev === undefined) delete process.env.E2E_SMM_V3
    else process.env.E2E_SMM_V3 = prev
  })

  test('is false when E2E_SMM_V3 is unset', () => {
    delete process.env.E2E_SMM_V3
    expect(isE2eSmmV3Enabled()).toBe(false)
  })

  test('is false when E2E_SMM_V3 is not "true"', () => {
    process.env.E2E_SMM_V3 = '1'
    expect(isE2eSmmV3Enabled()).toBe(false)
  })

  test('is true when E2E_SMM_V3 is "true"', () => {
    process.env.E2E_SMM_V3 = 'true'
    expect(isE2eSmmV3Enabled()).toBe(true)
  })
})

describe('localStorageEntriesAfterClear', () => {
  test('is empty when v3 is off', () => {
    expect(localStorageEntriesAfterClear({} as NodeJS.ProcessEnv)).toEqual({})
  })

  test('sets smm.v3.enabled when E2E_SMM_V3=true', () => {
    expect(localStorageEntriesAfterClear({ E2E_SMM_V3: 'true' } as NodeJS.ProcessEnv)).toEqual({
      'smm.v3.enabled': 'true',
    })
  })
})
