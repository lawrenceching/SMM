class Prompts {

    get aiBasedRecognizePrompt() {
        return browser.$('[data-testid="ai-based-recognize-status"]')
    }

    get aiBasedRenamePrompt() {
        return browser.$('[data-testid="ai-based-rename-status"]')
    }

    get confirmButton() {
        return browser.$('[data-testid="floating-prompt-confirm-button"]')
    }

    get cancelButton() {
        return browser.$('[data-testid="floating-prompt-cancel-button"]')
    }

}

export default new Prompts()