import { describe, it, expect } from "vitest"
import enComponents from "../../../public/locales/en/components.json"
import zhCNComponents from "../../../public/locales/zh-CN/components.json"
import zhHKComponents from "../../../public/locales/zh-HK/components.json"
import zhTWComponents from "../../../public/locales/zh-TW/components.json"
import enSettings from "../../../public/locales/en/settings.json"
import zhCNSettings from "../../../public/locales/zh-CN/settings.json"
import zhHKSettings from "../../../public/locales/zh-HK/settings.json"
import zhTWSettings from "../../../public/locales/zh-TW/settings.json"

interface ConsentDialogCatalog {
  anonymousTelemetryConsent: {
    title: string
    description: string
    agree: string
    disagree: string
  }
}

interface SettingsCatalog {
  general: {
    anonymousTelemetryConsent: string
    anonymousTelemetryConsentDescription: string
  }
}

const componentLocales: { name: string; data: ConsentDialogCatalog }[] = [
  { name: "en", data: enComponents as unknown as ConsentDialogCatalog },
  { name: "zh-CN", data: zhCNComponents as unknown as ConsentDialogCatalog },
  { name: "zh-HK", data: zhHKComponents as unknown as ConsentDialogCatalog },
  { name: "zh-TW", data: zhTWComponents as unknown as ConsentDialogCatalog },
]

const settingsLocales: { name: string; data: SettingsCatalog }[] = [
  { name: "en", data: enSettings as unknown as SettingsCatalog },
  { name: "zh-CN", data: zhCNSettings as unknown as SettingsCatalog },
  { name: "zh-HK", data: zhHKSettings as unknown as SettingsCatalog },
  { name: "zh-TW", data: zhTWSettings as unknown as SettingsCatalog },
]

describe("anonymous telemetry consent locale catalog", () => {
  for (const { name, data } of componentLocales) {
    describe(`components ${name}`, () => {
      it("defines anonymousTelemetryConsent dialog strings", () => {
        const block = data.anonymousTelemetryConsent
        expect(typeof block.title).toBe("string")
        expect(block.title.length).toBeGreaterThan(0)
        expect(typeof block.description).toBe("string")
        expect(block.description.length).toBeGreaterThan(0)
        expect(typeof block.agree).toBe("string")
        expect(block.agree.length).toBeGreaterThan(0)
        expect(typeof block.disagree).toBe("string")
        expect(block.disagree.length).toBeGreaterThan(0)
      })
    })
  }

  for (const { name, data } of settingsLocales) {
    describe(`settings ${name}`, () => {
      it("defines general.anonymousTelemetryConsent strings", () => {
        expect(typeof data.general.anonymousTelemetryConsent).toBe("string")
        expect(data.general.anonymousTelemetryConsent.length).toBeGreaterThan(0)
        expect(typeof data.general.anonymousTelemetryConsentDescription).toBe("string")
        expect(data.general.anonymousTelemetryConsentDescription.length).toBeGreaterThan(0)
      })
    })
  }
})
