import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('I hover over "Recognize" hint icon', async (_ctx, _args) => {
    const icon = Prompts.ruleBasedRecognizeHintIcon
    await icon.waitForDisplayed({ timeout: 10000 })
    await icon.scrollIntoView()
    await icon.moveTo()
    // Electron on Windows arm64 accepts moveTo but does not deliver the pointer
    // event Radix uses to open the tooltip. Focus plus a bubbling pointermove does.
    await browser.execute((el: HTMLElement) => {
        el.focus()
        el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }))
    }, icon)
})
