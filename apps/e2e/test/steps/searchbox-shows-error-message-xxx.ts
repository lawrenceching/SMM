import { registerStep } from '../lib/gherkin'
import { expect } from '@wdio/globals'

registerStep('Searchbox shows error message "xxx"', async (_ctx, args) => {
    const [expectedText] = args
    const errorEl = await $('[data-testid="tmdb-search-error"]')
    await errorEl.waitForDisplayed({ timeout: 30000 })
    const text = await errorEl.getText()
    expect(text).toContain(expectedText)
})
