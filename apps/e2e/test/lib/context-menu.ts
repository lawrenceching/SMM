import { browser } from '@wdio/globals'

const CONTEXT_MENU_CONTENT_SELECTOR = '[data-slot="context-menu-content"], [role="menu"]'

/**
 * Right-click an element reliably on Windows/Linux (Radix context menus).
 * WebdriverIO's `click({ button: 'right' })` often fails to open Radix menus on Windows.
 */
export async function rightClickElement(element: WebdriverIO.Element): Promise<void> {
    await element.scrollIntoView()
    await element.waitForDisplayed({ timeout: 10_000 })

    await element.click({ button: 'right' })
    await browser.pause(200)
    const menuAfterClick = await $(CONTEXT_MENU_CONTENT_SELECTOR)
    if (await menuAfterClick.isDisplayed().catch(() => false)) {
        return
    }

    await browser.performActions([
        {
            type: 'pointer',
            id: 'pointer1',
            parameters: { pointerType: 'mouse' },
            actions: [
                { type: 'pointerMove', origin: element, x: 0, y: 0, duration: 0 },
                { type: 'pointerDown', button: 2 },
                { type: 'pointerUp', button: 2 },
            ],
        },
    ])
    await browser.releaseActions()
    await browser.pause(200)

    const menuAfterActions = await $(CONTEXT_MENU_CONTENT_SELECTOR)
    if (await menuAfterActions.isDisplayed().catch(() => false)) {
        return
    }

    await browser.execute((el) => {
        el.dispatchEvent(
            new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                buttons: 2,
            }),
        )
    }, element)
    await browser.pause(200)
}

export async function waitForContextMenuItem(labels: string[], timeout = 5000): Promise<void> {
    await browser.waitUntil(
        async () => {
            for (const label of labels) {
                const byRole = await $(`[role="menuitem"]=${label}`)
                if (await byRole.isDisplayed().catch(() => false)) return true
                const bySlot = await $(`[data-slot="context-menu-item"]=${label}`)
                if (await bySlot.isDisplayed().catch(() => false)) return true
            }
            return false
        },
        {
            timeout,
            interval: 200,
            timeoutMsg: `Context menu item [${labels.join(', ')}] did not appear`,
        },
    )
}

export async function clickContextMenuItem(labels: string[]): Promise<void> {
    await waitForContextMenuItem(labels)
    for (const label of labels) {
        for (const selector of [`[role="menuitem"]=${label}`, `[data-slot="context-menu-item"]=${label}`]) {
            const item = await $(selector)
            if (await item.isDisplayed().catch(() => false)) {
                await item.waitForClickable({ timeout: 3000 })
                await item.click()
                return
            }
        }
    }
    throw new Error(`Context menu item [${labels.join(', ')}] not found`)
}
