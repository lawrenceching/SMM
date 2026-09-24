import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { tMock } = vi.hoisted(() => ({
  tMock: vi.fn((key: string) => {
    if (key === "planReady.notification.title") return "SMM"
    if (key === "planReady.notification.body") return "A plan is waiting for your approval"
    return key
  }),
}))

vi.mock("@/lib/i18n", () => ({
  default: { t: tMock },
}))

import { showPlanReadyNotification } from "./planReadyNotification"

type NotificationInstance = {
  title: string
  options: NotificationOptions | undefined
  onclick: ((this: Notification, ev: Event) => unknown) | null
}

describe("showPlanReadyNotification", () => {
  let NotificationMock: ReturnType<typeof vi.fn> & { permission: NotificationPermission }
  let createdNotifications: NotificationInstance[]
  let focusMock: ReturnType<typeof vi.fn>
  let originalHiddenDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    createdNotifications = []
    focusMock = vi.fn()
    vi.stubGlobal("focus", focusMock)
    Object.defineProperty(window, "focus", { configurable: true, value: focusMock })

    NotificationMock = Object.assign(
      vi.fn(function (this: NotificationInstance, title: string, options?: NotificationOptions) {
        this.title = title
        this.options = options
        this.onclick = null
        createdNotifications.push(this)
      }),
      { permission: "granted" as NotificationPermission },
    )
    vi.stubGlobal("Notification", NotificationMock)

    originalHiddenDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "hidden")
      ?? Object.getOwnPropertyDescriptor(document, "hidden")
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    })

    tMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalHiddenDescriptor) {
      Object.defineProperty(document, "hidden", originalHiddenDescriptor)
    } else {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      })
    }
  })

  it("shows a tagged system notification when the document is hidden and permission is granted", () => {
    showPlanReadyNotification("task-1")

    expect(NotificationMock).toHaveBeenCalledTimes(1)
    expect(NotificationMock).toHaveBeenCalledWith("SMM", {
      body: "A plan is waiting for your approval",
      tag: "smm-plan-ready-task-1",
    })
    expect(tMock).toHaveBeenCalledWith("planReady.notification.title")
    expect(tMock).toHaveBeenCalledWith("planReady.notification.body")
  })

  it("does nothing when the document is visible", () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    })

    showPlanReadyNotification("task-1")

    expect(NotificationMock).not.toHaveBeenCalled()
  })

  it("does nothing when Notification.permission is not granted", () => {
    NotificationMock.permission = "denied"

    showPlanReadyNotification("task-1")

    expect(NotificationMock).not.toHaveBeenCalled()
  })

  it("does nothing when Notification API is unavailable", () => {
    vi.stubGlobal("Notification", undefined)

    expect(() => showPlanReadyNotification("task-1")).not.toThrow()
  })

  it("focuses the window when the notification is clicked", () => {
    showPlanReadyNotification("task-1")

    const lastInstance = createdNotifications.at(-1)
    expect(lastInstance).toBeDefined()
    lastInstance!.onclick?.call(lastInstance as unknown as Notification, new Event("click"))

    expect(focusMock).toHaveBeenCalledTimes(1)
  })

  it("swallows errors from the Notification constructor", () => {
    const ThrowingNotification = Object.assign(
      function () {
        throw new Error("boom")
      },
      { permission: "granted" as NotificationPermission },
    )
    vi.stubGlobal("Notification", ThrowingNotification)

    expect(() => showPlanReadyNotification("task-1")).not.toThrow()
  })

  it("uses a distinct tag per taskId so the OS can replace duplicates", () => {
    showPlanReadyNotification("a")
    showPlanReadyNotification("b")

    expect(NotificationMock).toHaveBeenNthCalledWith(1, "SMM", expect.objectContaining({ tag: "smm-plan-ready-a" }))
    expect(NotificationMock).toHaveBeenNthCalledWith(2, "SMM", expect.objectContaining({ tag: "smm-plan-ready-b" }))
  })
})
