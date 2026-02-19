import { expect, browser } from '@wdio/globals'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

describe('Assistant', () => {

    before(async () => {
        await createBeforeHook({ setupMediaFolders: false })()
    })

    it('should open assistant, send message, and receive AI response', async function() {
        if (slowdown) {
            this.timeout(60 * 1000)
        }

        // Step 1: Open the Assistant Modal
        console.log('Opening Assistant modal...')
        const assistantButton = await browser.$('button.aui-modal-button')
        await assistantButton.waitForDisplayed({ timeout: 10000 })
        await assistantButton.click()

        if (slowdown) {
            await delay(1 * 1000)
        }

        // Verify the modal is open by checking for the composer input
        console.log('Verifying Assistant modal is open...')
        const composerInput = await browser.$('textarea.aui-composer-input')
        await composerInput.waitForDisplayed({ timeout: 10000 })
        expect(await composerInput.isDisplayed()).toBe(true)

        if (slowdown) {
            await delay(1 * 1000)
        }

        // Step 2: Input "Hello"
        console.log('Inputting "Hello" message...')
        await composerInput.setValue('Hello')

        if (slowdown) {
            await delay(1 * 1000)
        }

        // Step 3: Click send button
        console.log('Clicking send button...')
        const sendButton = await browser.$('button.aui-composer-send')
        await sendButton.waitForDisplayed({ timeout: 10000 })
        await sendButton.click()

        // Wait for AI response
        await delay(2 * 1000)

        if (slowdown) {
            await delay(2 * 1000)
        }

        // Step 4: Wait for AI response and assert something is returned
        console.log('Waiting for AI response...')
        
        // Wait for the assistant message to appear
        const assistantMessage = await browser.$('div.aui-assistant-message-root[data-role="assistant"]')
        
        // Wait for the message to contain text (indicating response received)
        await browser.waitUntil(async () => {
            const messageElement = await assistantMessage
            const isDisplayed = await messageElement.isDisplayed()
            if (!isDisplayed) return false
            
            // Get the text content of the message
            const textContent = await messageElement.getText()
            console.log('Assistant response text:', textContent)
            
            // Check that there's some content (not empty)
            return textContent && textContent.length > 0
        }, {
            timeout: 30000,
            timeoutMsg: 'AI response was not received within 30 seconds'
        })

        // Verify the assistant message is displayed
        expect(await assistantMessage.isDisplayed()).toBe(true)
        
        // Verify the response has content
        const responseText = await assistantMessage.getText()
        expect(responseText.length).toBeGreaterThan(0)
        
        console.log('AI response received:', responseText.substring(0, 100) + '...')
        console.log('Assistant test completed successfully')
    })

})
