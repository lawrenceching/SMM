/**
 * DownloadVideoDialog - User Agreement Flow (4.1)
 *
 * Tests TC-AG-01 through TC-AG-05 covering:
 * - New user sees agreement block, all controls disabled
 * - Checking agreement enables controls and persists to localStorage
 * - Previously agreed user skips agreement block
 * - Start button has no effect without agreement
 * - Cancel → reopen retains agreement state
 */

import { createAndImportFolder } from "test/actions/import-folders"
import { cleanup, setup } from "test/lib/testbed"
import MusicPanel from "test/componentobjects/MusicPanel.co"
import DownloadVideoDialogCO from "test/componentobjects/DownloadVideoDialog.co"

const LOCALSTORAGE_AGREEMENT_KEY = "DownloadVideoDialog.userAgreed"

/**
 * Helper: set localStorage before the dialog opens.
 * Called after the page is loaded but before clicking the download button.
 */
async function setLocalStorageAgreement(value: boolean): Promise<void> {
    await browser.execute(
        (key: string, val: string) => {
            localStorage.setItem(key, val)
        },
        LOCALSTORAGE_AGREEMENT_KEY,
        String(value),
    )
}

/**
 * Helper: read localStorage agreement value from the browser context.
 */
async function getLocalStorageAgreement(): Promise<string | null> {
    return browser.execute((key: string) => {
        return localStorage.getItem(key)
    }, LOCALSTORAGE_AGREEMENT_KEY)
}

describe("MusicPanel - Download - User Agreement (4.1)", () => {
    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })

    afterEach(async () => {
        // Close the dialog if still open to avoid blocking sidebar cleanup
        if (await DownloadVideoDialogCO.isDisplayed()) {
            await DownloadVideoDialogCO.clickCancel()
            await DownloadVideoDialogCO.waitForClosed(3000)
        }

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-01: New user sees agreement block, all controls disabled
    // ────────────────────────────────────────────────────────────────
    it("TC-AG-01: shows agreement block and disables all inputs on first open", async () => {
        // Create a music folder so the download button is visible
        await createAndImportFolder({
            folderName: "AgreementTestMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download-Agreement:TC-AG-01")

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        // Agreement block must be visible
        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        // URL and folder inputs must be disabled before agreement
        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(false)
        expect(await folderInput.isEnabled()).toBe(false)

        // Start button must be disabled
        const startButton = DownloadVideoDialogCO.startButton
        expect(await startButton.isEnabled()).toBe(false)

        // Folder picker must be disabled
        const folderPicker = DownloadVideoDialogCO.folderPickerButton
        expect(await folderPicker.isEnabled()).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-02: Check agreement enables controls, persists to localStorage
    // ────────────────────────────────────────────────────────────────
    it("TC-AG-02: checking agreement enables controls and persists to localStorage", async () => {
        await createAndImportFolder({
            folderName: "AgreementTestMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download-Agreement:TC-AG-02")

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()
        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        // Agreement block should still be visible before checking
        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        // Check the agreement checkbox
        await DownloadVideoDialogCO.setAgreement(true)

        // After checking, the agreement section should disappear from DOM
        // (hasAgreed=true hides the AgreementSection component)
        await browser.waitUntil(
            async () => !(await DownloadVideoDialogCO.agreementCheckbox.isExisting()),
            {
                timeout: 5000,
                timeoutMsg: "Agreement checkbox did not disappear after checking",
            },
        )

        // URL and folder inputs must now be enabled
        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(true)
        expect(await folderInput.isEnabled()).toBe(true)

        // Folder picker must now be enabled
        const folderPicker = DownloadVideoDialogCO.folderPickerButton
        expect(await folderPicker.isEnabled()).toBe(true)

        // localStorage must have been written
        const stored = await getLocalStorageAgreement()
        expect(stored).toBe("true")
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-03: Previously agreed user skips agreement block
    // ────────────────────────────────────────────────────────────────
    it("TC-AG-03: previously agreed user skips agreement block", async () => {
        // Pre-set localStorage before the dialog opens
        await setLocalStorageAgreement(true)

        await createAndImportFolder({
            folderName: "AgreementTestMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download-Agreement:TC-AG-03")

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        // Agreement block must NOT be visible
        expect(DownloadVideoDialogCO.agreementCheckbox).not.toBeExisting()

        // URL and folder inputs must be enabled from the start
        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(true)
        expect(await folderInput.isEnabled()).toBe(true)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-04: Start button disabled without agreement
    // ────────────────────────────────────────────────────────────────
    it("TC-AG-04: Start button is disabled and has no effect without agreement", async () => {
        await createAndImportFolder({
            folderName: "AgreementTestMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download-Agreement:TC-AG-04")

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        // Start button must be disabled initially (no agreement, no URL, no folder)
        const startButton = DownloadVideoDialogCO.startButton
        expect(await startButton.isEnabled()).toBe(false)

        // Even if we try to interact with other fields, they are disabled without agreement.
        // (URL and folder inputs are disabled before agreement.)
        // The only actionable verification is that Start stays disabled.
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-05: Cancel → reopen retains agreement state
    // ────────────────────────────────────────────────────────────────
    it("TC-AG-05: cancel and reopen retains agreement state from localStorage", async () => {
        // First session: agree and close
        await createAndImportFolder({
            folderName: "AgreementTestMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download-Agreement:TC-AG-05")

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()
        await DownloadVideoDialogCO.waitForDisplayed()

        // Verify agreement block is shown
        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        // Check agreement
        await DownloadVideoDialogCO.setAgreement(true)

        // Wait for agreement section to disappear
        await browser.waitUntil(
            async () => !(await DownloadVideoDialogCO.agreementCheckbox.isExisting()),
            {
                timeout: 5000,
                timeoutMsg: "Agreement checkbox did not disappear after checking",
            },
        )

        // Verify localStorage was written
        expect(await getLocalStorageAgreement()).toBe("true")

        // Close dialog via Cancel
        await DownloadVideoDialogCO.clickCancel()
        await DownloadVideoDialogCO.waitForClosed()

        // Reopen dialog
        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()
        await DownloadVideoDialogCO.waitForDisplayed()

        // Agreement block must NOT appear again (localStorage persisted)
        expect(DownloadVideoDialogCO.agreementCheckbox).not.toBeExisting()

        // URL and folder inputs must be enabled
        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(true)
        expect(await folderInput.isEnabled()).toBe(true)
    })
})
