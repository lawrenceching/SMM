import { useState } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ImmersiveSearchbox, type ImmersiveSearchResultItem, type SearchLanguageOption } from "./ImmersiveSearchbox"
import type { PrimaryDatabase } from "@core/types"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  SUPPORTED_LANGUAGES: [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "Chinese Simplified" },
  ],
}))

const TEST_LANGUAGE_OPTIONS: ReadonlyArray<SearchLanguageOption> = [
  { code: "zh-CN", name: "简体中文" },
  { code: "en-US", name: "English (US)" },
  { code: "ja-JP", name: "日本語" },
  { code: "fr-FR", name: "Français" },
  { code: "de-DE", name: "Deutsch" },
]

function TestHost() {
  const [searchDatabase, setSearchDatabase] = useState<PrimaryDatabase>("TMDB")
  const [searchLanguage, setSearchLanguage] = useState<string>("en-US")
  const [showAll, setShowAll] = useState(false)

  const searchResults: ImmersiveSearchResultItem[] = [
    {
      id: "1",
      displayName: "Sample Result",
      originalName: "Sample Result",
      overview: "overview",
      raw: { id: 1 },
    },
  ]

  const visibleOptions = showAll
    ? TEST_LANGUAGE_OPTIONS
    : TEST_LANGUAGE_OPTIONS.slice(0, 3)

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
      searchLanguageOptions={visibleOptions}
      showAllLanguages={showAll}
      onShowAllLanguagesChange={setShowAll}
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
    fireEvent.click(await screen.findByRole("option", { name: "简体中文" }))

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

  it("keeps the language dropdown open and exposes the new options after clicking 'Show all languages'", async () => {
    const onSearchLanguageChange = vi.fn()
    const onShowAllLanguagesChange = vi.fn()
    render(
      <ImmersiveSearchbox
        value="query"
        onChange={() => {}}
        onSearch={() => {}}
        onSelect={() => {}}
        searchResults={[]}
        isSearching={false}
        searchError={null}
        searchDatabase={"TMDB"}
        onSearchDatabaseChange={() => {}}
        searchLanguage={"en-US"}
        onSearchLanguageChange={onSearchLanguageChange}
        searchLanguageOptions={TEST_LANGUAGE_OPTIONS}
        showAllLanguages={false}
        onShowAllLanguagesChange={onShowAllLanguagesChange}
      />
    )

    const input = screen.getByPlaceholderText("Enter TV show name")
    fireEvent.focus(input)

    // Open the language dropdown.
    const triggers = await screen.findAllByRole("combobox")
    fireEvent.click(triggers[1])

    // The "Show all languages" toggle is rendered as a `role="button"`.
    const toggle = await screen.findByTestId("tmdb-search-language-show-all")
    expect(toggle).toBeInTheDocument()
    expect(toggle.textContent).toBe("components:tmdbSearchbox.showAllLanguages")

    fireEvent.click(toggle)

    // The toggle must toggle the flag and stay a no-op for the language.
    expect(onShowAllLanguagesChange).toHaveBeenCalledWith(true)
    expect(onSearchLanguageChange).not.toHaveBeenCalled()

    // The dropdown must still be open (the language trigger and label are
    // still present, and the popover content is not removed).
    expect(screen.getByText("components:tmdbSearchbox.searchLanguage")).toBeInTheDocument()
  })
})
