import { expect } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import RenameDialog from '../componentobjects/RenameDialog'

registerStep('rename dialog is displayed with value "xxx"', async (_ctx, args) => {
    const [value] = args
    const dialogDisplayed = await RenameDialog.waitForDisplayed(5000)
    expect(dialogDisplayed).toBe(true)
    expect(await RenameDialog.getInputValue()).toBe(value)
})

registerStep('rename dialog confirm button is disabled', async () => {
    expect(await RenameDialog.isConfirmDisabled()).toBe(true)
})

registerStep('I enter "xxx" in rename dialog', async (_ctx, args) => {
    const [value] = args
    await RenameDialog.setInputValue(value)
    expect(await RenameDialog.getInputValue()).toBe(value)
})

registerStep('rename dialog confirm button is enabled', async () => {
    expect(await RenameDialog.isConfirmDisabled()).toBe(false)
})

registerStep('I confirm rename dialog', async () => {
    await RenameDialog.clickConfirm()
    await RenameDialog.waitForClosed()
})
