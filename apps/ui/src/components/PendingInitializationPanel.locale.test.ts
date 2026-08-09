import { describe, it, expect } from "vitest"
import en from "../../public/locales/en/components.json"
import zhCN from "../../public/locales/zh-CN/components.json"
import zhHK from "../../public/locales/zh-HK/components.json"
import zhTW from "../../public/locales/zh-TW/components.json"

interface PendingInitializationPanel {
  title: string
  description: string
}

interface Catalog {
  pendingInitializationPanel: PendingInitializationPanel
  statusBar: { messages: { initializingFolder: string } }
  mediaFolder: { pendingForInitialization: string }
}

const locales: { name: string; data: Catalog }[] = [
  { name: "en", data: en as unknown as Catalog },
  { name: "zh-CN", data: zhCN as unknown as Catalog },
  { name: "zh-HK", data: zhHK as unknown as Catalog },
  { name: "zh-TW", data: zhTW as unknown as Catalog },
]

describe("pending-initialization locale catalog", () => {
  for (const { name, data } of locales) {
    describe(name, () => {
      it("defines statusBar.messages.initializingFolder as a non-empty string", () => {
        expect(typeof data.statusBar.messages.initializingFolder).toBe("string")
        expect(data.statusBar.messages.initializingFolder.length).toBeGreaterThan(0)
      })
      it("defines mediaFolder.pendingForInitialization as a non-empty string", () => {
        expect(typeof data.mediaFolder.pendingForInitialization).toBe("string")
        expect(data.mediaFolder.pendingForInitialization.length).toBeGreaterThan(0)
      })
      it("defines pendingInitializationPanel.title and description as non-empty strings", () => {
        expect(data.pendingInitializationPanel.title.length).toBeGreaterThan(0)
        expect(data.pendingInitializationPanel.description.length).toBeGreaterThan(0)
      })
    })
  }
})
