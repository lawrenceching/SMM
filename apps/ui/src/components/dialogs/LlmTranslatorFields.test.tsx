/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { LlmTranslatorFields } from "./LlmTranslatorFields"
import type { LlmTranslatorFieldsValue } from "@/lib/llmTranslatorFields"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const mockUseConfig = vi.fn()

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}))

describe("LlmTranslatorFields", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseConfig.mockReturnValue({
      userConfig: {
        aiProviders: [
          {
            name: "DeepSeek",
            baseURL: "https://api.deepseek.com",
            apiKey: "sk-secret-key",
            model: "deepseek-v4-flash",
          },
        ],
        selectedAIProvider: "DeepSeek",
      },
    })
  })

  it("shows read-only configured fields and switches to custom inputs", () => {
    const onChange = vi.fn()
    const value: LlmTranslatorFieldsValue = {
      mode: "configured",
      providerName: "DeepSeek",
      custom: { apiKey: "", apiBase: "", model: "" },
    }

    const { rerender } = render(
      <LlmTranslatorFields value={value} onChange={onChange} testIdPrefix="test" />,
    )

    expect(screen.getByTestId("test-api-base-readonly")).toHaveValue("https://api.deepseek.com")
    expect(screen.getByTestId("test-model-readonly")).toHaveValue("deepseek-v4-flash")
    expect((screen.getByTestId("test-api-key-readonly") as HTMLInputElement).value).toMatch(/key$/)

    fireEvent.click(screen.getByTestId("test-source-custom"))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "custom" }))

    rerender(
      <LlmTranslatorFields
        value={{ ...value, mode: "custom" }}
        onChange={onChange}
        testIdPrefix="test"
      />,
    )
    expect(screen.getByTestId("test-api-key")).toBeInTheDocument()
  })
})
