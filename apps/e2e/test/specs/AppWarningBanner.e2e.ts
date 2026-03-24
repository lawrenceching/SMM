import { expect, browser } from '@wdio/globals'
import env from '../lib/env'

const WARNING_BANNER_SELECTOR = '[data-testid="app-warning-banner"]'
const WARNING_DISMISSED_KEY = 'warning.appNotFullyTestedInMacOsOrLinux'

const isWindows = env.os === 'win32'

if (isWindows) {
  describe.skip('AppWarningBanner - Skip on Windows', () => {})
} else {
  describe('AppWarningBanner - macOS and Linux Testing', () => {
    before(async () => {
      await browser.url('http://localhost:5173')
    })

    afterEach(async () => {
      await browser.execute((warningDismissedKey) => {
        if (localStorage.getItem(warningDismissedKey) !== null) {
          localStorage.removeItem(warningDismissedKey)
        }
      }, WARNING_DISMISSED_KEY)
      await browser.refresh()
    })

    it('should display warning banner on macOS and Linux on first load', async () => {
      await browser.execute((warningDismissedKey) => {
        if (localStorage.getItem(warningDismissedKey) !== null) {
          localStorage.removeItem(warningDismissedKey)
        }
      }, WARNING_DISMISSED_KEY)
      await browser.refresh()

      await browser.pause(1000)
      console.log('browser was reset, start to run test')

      $(WARNING_BANNER_SELECTOR).waitForDisplayed({ timeout: 5000 })
      console.log('warning banner displayed')

      const text = await $(WARNING_BANNER_SELECTOR).$('p')
      const textContent = await text.getText()
      console.log('text content:', textContent)
      expect(textContent).toContain('This app is not fully tested on macOS and Linux')
      expect(textContent).toContain('report BUG')
    })
  })
}
