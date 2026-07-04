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

    get ruleBasedRecognizeNotAllMessage() {
        return browser.$('[data-testid="rule-based-recognize-not-all-message"]')
    }

    get ruleBasedRecognizeHintIcon() {
        return browser.$('[data-testid="rule-based-recognize-hint-icon"]')
    }

    get ruleBasedRecognizeHintTooltip() {
        return browser.$('[data-testid="rule-based-recognize-hint-tooltip"]')
    }

}

export default new Prompts()