import { browser } from '@wdio/globals'

/**
* main page object containing all methods, selectors and functionality
* that is shared across all page objects
*/
class Page {
    /**
    * Opens a sub page of the page
    * @param path path of the sub page (e.g. /path/to/page.html)
    */
    public open (url?: string) {
        const base = url ?? `http://localhost:5173`
        const token = process.env.SMM_AUTH_TOKEN
        const targetUrl = token ? `${base}?token=${encodeURIComponent(token)}` : base
        return browser.url(targetUrl)
    }

    /**
    * Refreshes the current page
    */
    public async refresh() {
        await browser.refresh()
    }
}

export default new Page();