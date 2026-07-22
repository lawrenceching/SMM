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

import { cleanup, setup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import MusicPanel from 'test/componentobjects/MusicPanel.co'
import DownloadVideoDialogCO from 'test/componentobjects/DownloadVideoDialog.co'

import { testbedOs } from 'test/lib/e2e-platform'

const LOCALSTORAGE_AGREEMENT_KEY = 'DownloadVideoDialog.userAgreed'

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

/**
 * @supports local, Electron
 * @unsupported HarmonyOS
 */
describe('MusicPanel - Download - User Agreement (4.1)', () => {
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
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
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-01: New user sees agreement block, all controls disabled
    // ────────────────────────────────────────────────────────────────
    it('TC-AG-01: shows agreement block and disables all inputs on first open', async () => {
        await createAndImportFolderViaBrowser({
            folderName: 'AgreementTestMusic',
            type: 'music',
            files: [],
        }, 'e2eTest:MusicPanel-Download-Agreement:TC-AG-01')

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(false)
        expect(await folderInput.isEnabled()).toBe(false)

        const startButton = DownloadVideoDialogCO.startButton
        expect(await startButton.isEnabled()).toBe(false)

        const folderPicker = DownloadVideoDialogCO.folderPickerButton
        expect(await folderPicker.isEnabled()).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-02: Check agreement enables controls, persists to localStorage
    // ────────────────────────────────────────────────────────────────
    it('TC-AG-02: checking agreement enables controls and persists to localStorage', async () => {
        await createAndImportFolderViaBrowser({
            folderName: 'AgreementTestMusic',
            type: 'music',
            files: [],
        }, 'e2eTest:MusicPanel-Download-Agreement:TC-AG-02')

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()
        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        await DownloadVideoDialogCO.setAgreement(true)

        await browser.waitUntil(
            async () => !(await DownloadVideoDialogCO.agreementCheckbox.isExisting()),
            {
                timeout: 5000,
                timeoutMsg: 'Agreement checkbox did not disappear after checking',
            },
        )

        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(true)
        expect(await folderInput.isEnabled()).toBe(true)

        const folderPicker = DownloadVideoDialogCO.folderPickerButton
        expect(await folderPicker.isEnabled()).toBe(true)

        const stored = await getLocalStorageAgreement()
        expect(stored).toBe('true')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-03: Previously agreed user skips agreement block
    // ────────────────────────────────────────────────────────────────
    it('TC-AG-03: previously agreed user skips agreement block', async () => {
        await setLocalStorageAgreement(true)

        await createAndImportFolderViaBrowser({
            folderName: 'AgreementTestMusic',
            type: 'music',
            files: [],
        }, 'e2eTest:MusicPanel-Download-Agreement:TC-AG-03')

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        expect(DownloadVideoDialogCO.agreementCheckbox).not.toBeExisting()

        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(true)
        expect(await folderInput.isEnabled()).toBe(true)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-04: Start button disabled without agreement
    // ────────────────────────────────────────────────────────────────
    it('TC-AG-04: Start button is disabled and has no effect without agreement', async () => {
        await createAndImportFolderViaBrowser({
            folderName: 'AgreementTestMusic',
            type: 'music',
            files: [],
        }, 'e2eTest:MusicPanel-Download-Agreement:TC-AG-04')

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        const startButton = DownloadVideoDialogCO.startButton
        expect(await startButton.isEnabled()).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-AG-05: Cancel → reopen retains agreement state
    // ────────────────────────────────────────────────────────────────
    it('TC-AG-05: cancel and reopen retains agreement state from localStorage', async () => {
        await createAndImportFolderViaBrowser({
            folderName: 'AgreementTestMusic',
            type: 'music',
            files: [],
        }, 'e2eTest:MusicPanel-Download-Agreement:TC-AG-05')

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()
        await DownloadVideoDialogCO.waitForDisplayed()

        expect(DownloadVideoDialogCO.agreementCheckbox).toBeDisplayed()

        await DownloadVideoDialogCO.setAgreement(true)

        await browser.waitUntil(
            async () => !(await DownloadVideoDialogCO.agreementCheckbox.isExisting()),
            {
                timeout: 5000,
                timeoutMsg: 'Agreement checkbox did not disappear after checking',
            },
        )

        expect(await getLocalStorageAgreement()).toBe('true')

        await DownloadVideoDialogCO.clickCancel()
        await DownloadVideoDialogCO.waitForClosed()

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()
        await DownloadVideoDialogCO.waitForDisplayed()

        expect(DownloadVideoDialogCO.agreementCheckbox).not.toBeExisting()

        const urlInput = DownloadVideoDialogCO.urlInput
        const folderInput = DownloadVideoDialogCO.folderInput
        expect(await urlInput.isEnabled()).toBe(true)
        expect(await folderInput.isEnabled()).toBe(true)
    })
})
