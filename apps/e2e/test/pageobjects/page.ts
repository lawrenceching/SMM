import { browser } from '@wdio/globals'
import { resolveUiPageUrl, type TestbedOs } from '../lib/ui-page-url'

/**
* main page object containing all methods, selectors and functionality
* that is shared across all page objects
*/
class Page {
    /**
    * Wait until the UI has finished its first folder-store init.
    * Avoids racing imports against UIMediaFolderStoreInitializer.
    */
    private async waitUntilAppReady() {
        await browser.waitUntil(
            async () => {
                const status = await browser.execute(
                    () => (window as Window & { _smm_status?: string })._smm_status,
                )
                return status === 'ready'
            },
            {
                timeout: 30000,
                timeoutMsg: 'Expected window._smm_status to become "ready"',
                interval: 200,
            },
        )
    }

    /**
    * Opens a sub page of the page
    * @param url Explicit URL (optional). When omitted, derived from `os`.
    * @param os `"general"` → Vite/desktop; `"HarmonyOS"` → `http://127.0.0.1:18081/`
    */
    public async open (url?: string, os: TestbedOs = 'general') {
        await browser.url(resolveUiPageUrl(url, os))
        await this.waitUntilAppReady()
    }

    /**
    * Refreshes the current page
    */
    public async refresh() {
        await browser.refresh()
        await this.waitUntilAppReady()
    }
}

export default new Page();
