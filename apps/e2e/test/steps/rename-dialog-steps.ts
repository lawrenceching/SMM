import { expect } from '@wdio/globals'
import { registerStep, requiredStepArg } from '../lib/gherkin'
import RenameDialog from '../componentobjects/RenameDialog'

registerStep('rename dialog is displayed with value "xxx"', async (_ctx, args) => {
    const value = requiredStepArg(args, 0)
    const dialogDisplayed = await RenameDialog.waitForDisplayed(5000)
    expect(dialogDisplayed).toBe(true)
    expect(await RenameDialog.getInputValue()).toBe(value)
})

registerStep('rename dialog confirm button is disabled', async () => {
    expect(await RenameDialog.isConfirmDisabled()).toBe(true)
})

registerStep('I enter "xxx" in rename dialog', async (_ctx, args) => {
    await RenameDialog.setInputValue(requiredStepArg(args, 0))
    expect(await RenameDialog.getInputValue()).toBe(requiredStepArg(args, 0))
})

registerStep('rename dialog confirm button is enabled', async () => {
    expect(await RenameDialog.isConfirmDisabled()).toBe(false)
})

registerStep('I confirm rename dialog', async () => {
    await RenameDialog.clickConfirm()
    await RenameDialog.waitForClosed()
})
