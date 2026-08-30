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

    get renameNamingRuleSelect() {
        return browser.$('[data-testid="rename-naming-rule-select"]')
    }

    namingRuleOption(rule: 'plex' | 'emby') {
        return browser.$(`[data-testid="rename-naming-rule-option-${rule}"]`)
    }

    async selectNamingRule(rule: 'plex' | 'emby'): Promise<void> {
        const trigger = await this.renameNamingRuleSelect
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()
        const option = await this.namingRuleOption(rule)
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

}

export default new Prompts()