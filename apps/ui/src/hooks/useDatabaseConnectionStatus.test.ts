import { describe, expect, it } from "vitest"
import { isInternalDatabaseCheckError, mapQueryStatus } from "@/lib/databaseConnectionCheck"

describe("isInternalDatabaseCheckError", () => {
  it("matches reverse proxy not available message", () => {
    expect(
      isInternalDatabaseCheckError(
        new Error(
          "Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.",
        ),
      ),
    ).toBe(true)
  })

  it("does not match upstream HTTP errors", () => {
    expect(isInternalDatabaseCheckError(new Error("Failed to get TV show: 404 Not Found"))).toBe(
      false,
    )
  })
})

describe("mapQueryStatus", () => {
  it("returns checking when check is disabled", () => {
    expect(mapQueryStatus(false, false, false, false, undefined)).toBe("checking")
  })

  it("returns checkFailed when query errored", () => {
    expect(mapQueryStatus(true, false, false, true, undefined)).toBe("checkFailed")
  })

  it("returns disconnected when data is false without error", () => {
    expect(mapQueryStatus(true, false, false, false, false)).toBe("disconnected")
  })

  it("returns connected when data is true", () => {
    expect(mapQueryStatus(true, false, false, false, true)).toBe("connected")
  })
})
