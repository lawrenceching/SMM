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
      await browser.url('/')
    })

    afterEach(async () => {
      await browser.execute(() => {
        localStorage.removeItem(WARNING_DISMISSED_KEY)
      })
      await browser.refresh()
    })

    it('should display warning banner on macOS and Linux on first load', async () => {
      await browser.execute(() => {
        localStorage.removeItem(WARNING_DISMISSED_KEY)
      })
      await browser.refresh()

      await browser.waitUntil(async () => {
        const banner = await browser.$(WARNING_BANNER_SELECTOR)
        return await banner.isDisplayed()
      }, {
        timeout: 5000,
        timeoutMsg: 'Warning banner should be displayed'
      })

      const banner = await browser.$(WARNING_BANNER_SELECTOR)
      expect(await banner.isDisplayed()).toBe(true)

      const text = await banner.$('p')
      const textContent = await text.getText()
      expect(textContent).toContain('This app is not fully tested on macOS and Linux')
      expect(textContent).toContain('report BUG')
    })
  })
}
