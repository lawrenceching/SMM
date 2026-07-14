import { browser } from '@wdio/globals'
import { resolveUiPageUrl } from '../lib/ui-page-url'

/**
* main page object containing all methods, selectors and functionality
* that is shared across all page objects
*/
class Page {
    /**
    * Opens a sub page of the page
    * @param path path of the sub page (e.g. /path/to/page.html)
    */
    public async open (url?: string) {
        return browser.url(resolveUiPageUrl(url))
    }

    /**
    * Refreshes the current page
    */
    public async refresh() {
        await browser.refresh()
    }
}

export default new Page();
