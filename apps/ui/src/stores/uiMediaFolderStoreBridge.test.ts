import { describe, expect, it } from "vitest"
import {
  selectSelectedFolderSnapshot,
  type UIMediaFolderStoreBridgeState,
} from "./uiMediaFolderStoreBridge"

describe("selectSelectedFolderSnapshot", () => {
  it("returns null when nothing is selected", () => {
    const state: UIMediaFolderStoreBridgeState = {
      selectedFolder: "",
      folders: [{ path: "/a", status: "ok", test: false }],
    }
    expect(selectSelectedFolderSnapshot(state)).toBeNull()
  })

  it("returns path and status for the selected folder", () => {
    const state: UIMediaFolderStoreBridgeState = {
      selectedFolder: "/a",
      folders: [{ path: "/a", status: "initializing", test: false }],
    }
    expect(selectSelectedFolderSnapshot(state)).toEqual({
      path: "/a",
      status: "initializing",
    })
  })

  it("returns null when selected path is missing from folders", () => {
    const state: UIMediaFolderStoreBridgeState = {
      selectedFolder: "/missing",
      folders: [{ path: "/a", status: "ok", test: false }],
    }
    expect(selectSelectedFolderSnapshot(state)).toBeNull()
  })
})
