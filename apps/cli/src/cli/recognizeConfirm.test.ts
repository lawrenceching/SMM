import { describe, expect, it } from 'vitest'
import { confirmRecognizeCandidate, formatRecognizePrompt } from './recognizeConfirm'

describe('formatRecognizePrompt', () => {
  it('includes title and year when year is present', () => {
    expect(formatRecognizePrompt({ title: 'WATATEN', year: '2019' })).toBe(
      'Is it "WATATEN (2019)"? [Y/n]',
    )
  })

  it('omits year parentheses when year is missing', () => {
    expect(formatRecognizePrompt({ title: 'WATATEN' })).toBe('Is it "WATATEN"? [Y/n]')
  })
})

describe('confirmRecognizeCandidate', () => {
  const candidate = { title: 'WATATEN', year: '2019' }

  it('returns true immediately when --yes is set', async () => {
    expect(await confirmRecognizeCandidate(candidate, { yes: true })).toBe(true)
  })

  it('treats empty, y, and yes as accept', async () => {
    expect(await confirmRecognizeCandidate(candidate, { ask: async () => '' })).toBe(true)
    expect(await confirmRecognizeCandidate(candidate, { ask: async () => ' y ' })).toBe(true)
    expect(await confirmRecognizeCandidate(candidate, { ask: async () => 'YES' })).toBe(true)
  })

  it('treats n as reject', async () => {
    expect(await confirmRecognizeCandidate(candidate, { ask: async () => 'n' })).toBe(false)
  })
})
