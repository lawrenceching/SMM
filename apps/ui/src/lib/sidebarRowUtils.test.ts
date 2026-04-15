import { describe, expect, it } from "vitest"
import { buildMediaFolderListItemPropsFromFolderAndMetadata } from "./sidebarRowUtils"

describe("buildMediaFolderListItemPropsFromFolderAndMetadata", () => {
  it("does not show loading status for pending_for_initialization", () => {
    const row = buildMediaFolderListItemPropsFromFolderAndMetadata(
      {
        path: "/media/Test",
        status: "pending_for_initialization",
      },
      undefined,
    )

    expect(row.status).toBe("idle")
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
})
