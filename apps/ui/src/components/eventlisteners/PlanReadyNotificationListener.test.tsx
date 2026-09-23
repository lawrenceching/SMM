import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { render, cleanup } from "@testing-library/react"
import { RecognizeMediaFilePlanReady, RenameFilesPlanReady } from "@smm/types/event-types"

const { showPlanReadyNotificationMock } = vi.hoisted(() => ({
  showPlanReadyNotificationMock: vi.fn(),
}))

vi.mock("@/lib/planReadyNotification", () => ({
  showPlanReadyNotification: showPlanReadyNotificationMock,
}))

import { PlanReadyNotificationListener } from "./PlanReadyNotificationListener"

describe("PlanReadyNotificationListener", () => {
  beforeEach(() => {
    showPlanReadyNotificationMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("calls showPlanReadyNotification with taskId on renameFilesPlanReady", () => {
    render(createElement(PlanReadyNotificationListener))

    document.dispatchEvent(
      new CustomEvent("socket.io_" + RenameFilesPlanReady.event, {
        detail: { taskId: "rename-task", planFilePath: "/plans/rename-task.plan.json" },
      }),
    )

    expect(showPlanReadyNotificationMock).toHaveBeenCalledTimes(1)
    expect(showPlanReadyNotificationMock).toHaveBeenCalledWith("rename-task")
  })

  it("calls showPlanReadyNotification with taskId on recognizeMediaFilePlanReady", () => {
    render(createElement(PlanReadyNotificationListener))

    document.dispatchEvent(
      new CustomEvent("socket.io_" + RecognizeMediaFilePlanReady.event, {
        detail: { taskId: "recognize-task", planFilePath: "/plans/recognize-task.plan.json" },
      }),
    )

    expect(showPlanReadyNotificationMock).toHaveBeenCalledTimes(1)
    expect(showPlanReadyNotificationMock).toHaveBeenCalledWith("recognize-task")
  })

  it("ignores events without a taskId", () => {
    render(createElement(PlanReadyNotificationListener))

    document.dispatchEvent(
      new CustomEvent("socket.io_" + RenameFilesPlanReady.event, {
        detail: { planFilePath: "/plans/x.plan.json" },
      }),
    )

    expect(showPlanReadyNotificationMock).not.toHaveBeenCalled()
  })

  it("removes listeners on unmount", () => {
    const { unmount } = render(createElement(PlanReadyNotificationListener))
    unmount()

    document.dispatchEvent(
      new CustomEvent("socket.io_" + RenameFilesPlanReady.event, {
        detail: { taskId: "after-unmount", planFilePath: "/plans/x.plan.json" },
      }),
    )

    expect(showPlanReadyNotificationMock).not.toHaveBeenCalled()
  })
})
