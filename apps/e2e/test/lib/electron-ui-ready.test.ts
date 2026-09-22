import { describe, expect, test } from 'bun:test'
import { isElectronAppUiReadyUrl } from './electron-ui-ready'

describe('isElectronAppUiReadyUrl', () => {
  test('accepts http(s) app URLs', () => {
    expect(isElectronAppUiReadyUrl('http://127.0.0.1:30000/')).toBe(true)
    expect(isElectronAppUiReadyUrl('https://127.0.0.1:30000/')).toBe(true)
  })

  test('rejects Electron Loading splash data URLs', () => {
    expect(
      isElectronAppUiReadyUrl(
        'data:text/html;charset=utf-8,%3C!DOCTYPE%20html%3E%3Ctitle%3ELoading%20-%20SMM%3C%2Ftitle%3E',
      ),
    ).toBe(false)
  })

  test('rejects empty and file URLs', () => {
    expect(isElectronAppUiReadyUrl('')).toBe(false)
    expect(isElectronAppUiReadyUrl('file:///tmp/index.html')).toBe(false)
  })
})
