import { describe, it, expect, beforeEach } from "vitest"
import {
  compareByDisplayName,
  sortPathsBySidebarDisplayOrder,
  useSidebarStore,
} from "./sidebarStore"

describe("compareByDisplayName", () => {
  it("returns 0 when sortOrder is none", () => {
    expect(compareByDisplayName("B", "A", "none")).toBe(0)
  })

  it("sorts ascending for alphabetical", () => {
    expect(compareByDisplayName("A", "B", "alphabetical")).toBeLessThan(0)
  })

  it("sorts descending for reverse-alphabetical", () => {
    expect(compareByDisplayName("A", "B", "reverse-alphabetical")).toBeGreaterThan(0)
  })
})

describe("sortPathsBySidebarDisplayOrder", () => {
  beforeEach(() => {
    useSidebarStore.setState({ sortOrder: "none", filterType: "all" })
  })

  it("preserves input order when sortOrder is none", () => {
    const paths = ["/z", "/a", "/m"]
    expect(sortPathsBySidebarDisplayOrder(paths, (p) => p)).toEqual(["/z", "/a", "/m"])
  })

  it("sorts by display name when alphabetical", () => {
    useSidebarStore.setState({ sortOrder: "alphabetical" })
    const paths = ["/z", "/a", "/m"]
    expect(sortPathsBySidebarDisplayOrder(paths, (p) => p.slice(1))).toEqual([
      "/a",
      "/m",
      "/z",
    ])
  })
})
