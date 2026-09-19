import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('I hover over "Recognize" hint icon', async (_ctx, _args) => {
    const icon = Prompts.ruleBasedRecognizeHintIcon
    await icon.waitForDisplayed({ timeout: 10000 })
    await icon.scrollIntoView()
    await icon.moveTo()
    // Electron on Windows arm64 accepts moveTo but does not deliver the pointer
    // event Radix uses to open the tooltip. Focus the trigger in the page instead.
    // Passing the WDIO element into execute yields a remote reference, not a DOM node.
    await browser.execute(() => {
        const el = document.querySelector('[data-testid="rule-based-recognize-hint-icon"]')
        if (!(el instanceof HTMLElement)) {
            throw new Error('recognize hint icon is not an HTMLElement')
        }
        el.focus()
        el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }))
    })
})
