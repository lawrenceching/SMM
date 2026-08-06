import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MediaFolderToolbar } from "./MediaFolderToolbar"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// jsdom lacks scrollIntoView, which Radix Select calls when opening its content
Element.prototype.scrollIntoView = vi.fn()

describe("MediaFolderToolbar i18n", () => {
  const baseProps = {
    sortOrder: "alphabetical" as const,
    onSortOrderChange: vi.fn(),
    filterType: "all" as const,
    onFilterTypeChange: vi.fn(),
  }

  it("passes the translated placeholder to the sort button", () => {
    render(<MediaFolderToolbar {...baseProps} />)
    expect(screen.getByTestId("sort-select-trigger")).toHaveTextContent("sidebar.toolbar.sort")
  })

  it("passes the translated placeholder to the filter button", () => {
    render(<MediaFolderToolbar {...baseProps} />)
    expect(screen.getByTestId("filter-select-trigger")).toHaveTextContent("sidebar.toolbar.filter")
  })

  it("renders translated sort option labels", async () => {
    render(<MediaFolderToolbar {...baseProps} />)
    fireEvent.click(screen.getByTestId("sort-select-trigger"))
    expect(await screen.findByTestId("sort-option-alphabetical")).toHaveTextContent(
      "sidebar.toolbar.sortAlphabetical",
    )
  })

  it("renders translated filter option labels", async () => {
    render(<MediaFolderToolbar {...baseProps} />)
    fireEvent.click(screen.getByTestId("filter-select-trigger"))
    expect(await screen.findByText("sidebar.toolbar.filterAll")).toBeInTheDocument()
  })
})
