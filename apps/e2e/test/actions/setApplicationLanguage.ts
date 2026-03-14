import { browser } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'

/**
 * Set the application language via the config dialog.
 * Opens the dialog, selects the given locale, saves, and closes the dialog.
 * @param locale Language code (e.g. 'en', 'zh-CN')
 */
export async function setApplicationLanguage(locale: string): Promise<void> {
    await Menu.openConfigDialog()
    await ConfigDialog.waitForDisplayed()
    await ConfigDialog.selectLanguage(locale)
    await ConfigDialog.clickSave()
    await ConfigDialog.pressEscape()
    await browser.pause(200)
    await ConfigDialog.pressEscape()
    await ConfigDialog.waitForClosed()
}
