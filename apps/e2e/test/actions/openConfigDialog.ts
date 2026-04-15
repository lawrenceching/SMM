import { browser } from '@wdio/globals'
import { env } from 'node:process'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'

type ConfigDialogCallback = () => Promise<void>

export async function openConfigDialog(callback: ConfigDialogCallback): Promise<void> {
    await Menu.openConfigDialog()
    if (env.slowdown) {
        await browser.pause(1000)
    }

    await ConfigDialog.waitForDisplayed()
    if (env.slowdown) {
        await browser.pause(1000)
    }

    await callback()

    await ConfigDialog.clickSave()
    await ConfigDialog.pressEscape()
    await browser.pause(1000)
}
