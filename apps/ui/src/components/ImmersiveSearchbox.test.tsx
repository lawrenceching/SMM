import { useState } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ImmersiveSearchbox, type ImmersiveSearchResultItem } from "./ImmersiveSearchbox"
import type { PrimaryDatabase } from "@core/types"
import type { SupportedLanguage } from "@/lib/i18n"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  SUPPORTED_LANGUAGES: [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "Chinese Simplified" },
  ],
}))

function TestHost() {
  const [searchDatabase, setSearchDatabase] = useState<PrimaryDatabase>("TMDB")
  const [searchLanguage, setSearchLanguage] = useState<SupportedLanguage>("en")

  const searchResults: ImmersiveSearchResultItem[] = [
    {
      id: "1",
      displayName: "Sample Result",
      originalName: "Sample Result",
      overview: "overview",
      raw: { id: 1 },
    },
  ]

  return (
    <ImmersiveSearchbox
      value="query"
      onChange={() => {}}
      onSearch={() => {}}
      onSelect={() => {}}
      searchResults={searchResults}
      isSearching={false}
      searchError={null}
      searchDatabase={searchDatabase}
      onSearchDatabaseChange={setSearchDatabase}
      searchLanguage={searchLanguage}
      onSearchLanguageChange={setSearchLanguage}
    />
  )
}

describe("ImmersiveSearchbox", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  it("keeps popover open after changing language and database", async () => {
    render(<TestHost />)

    const input = screen.getByPlaceholderText("Enter TV show name")
    fireEvent.focus(input)

    expect(await screen.findByText("components:tmdbSearchbox.database")).toBeInTheDocument()
    expect(await screen.findByText("components:tmdbSearchbox.searchLanguage")).toBeInTheDocument()

    const triggers = screen.getAllByRole("combobox")
    fireEvent.click(triggers[0])
    fireEvent.click(await screen.findByRole("option", { name: "TVDB" }))

    fireEvent.click(triggers[1])
    fireEvent.click(await screen.findByRole("option", { name: "Chinese Simplified" }))

    expect(screen.getByText("components:tmdbSearchbox.database")).toBeInTheDocument()
    expect(screen.getByText("components:tmdbSearchbox.searchLanguage")).toBeInTheDocument()
  })

  it("closes popover and calls onSelect after clicking a search result", async () => {
    const onSelect = vi.fn()
    const searchResults: ImmersiveSearchResultItem[] = [
      {
        id: "1",
        displayName: "Sample Result",
        originalName: "Sample Result",
        overview: "overview",
        raw: { id: 1 },
      },
    ]

    render(
      <ImmersiveSearchbox
        value="query"
        onChange={() => {}}
        onSearch={() => {}}
        onSelect={onSelect}
        searchResults={searchResults}
        isSearching={false}
        searchError={null}
      />
    )

    const input = screen.getByPlaceholderText("Enter TV show name")
    fireEvent.focus(input)
    fireEvent.click(screen.getByTestId("immersive-input-search-button"))

    expect(await screen.findByText("Sample Result")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Sample Result"))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Sample Result" }))
    expect(screen.queryByText("Sample Result")).not.toBeInTheDocument()
  })
})
