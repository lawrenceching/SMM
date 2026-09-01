import { describe, expect, it } from "vitest"
import { buildMediaFolderListItemPropsFromFolderAndMetadata } from "./sidebarRowUtils"

describe("buildMediaFolderListItemPropsFromFolderAndMetadata", () => {
  it("passes through pending_for_initialization status", () => {
    const row = buildMediaFolderListItemPropsFromFolderAndMetadata(
      {
        path: "/media/Test",
        status: "pending_for_initialization",
      },
      undefined,
    )

    expect(row.status).toBe("pending_for_initialization")
  })

  it("keeps loading status for updating", () => {
    const row = buildMediaFolderListItemPropsFromFolderAndMetadata(
      {
        path: "/media/Test",
        status: "updating",
      },
      undefined,
    )

    expect(row.status).toBe("loading")
  })

  it("maps initializing to loading", () => {
    const row = buildMediaFolderListItemPropsFromFolderAndMetadata(
      {
        path: "/media/Test",
        status: "initializing",
      },
      undefined,
    )

    expect(row.status).toBe("loading")
  })
})
