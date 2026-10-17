import { describe, it, expect } from "vitest"
import type { OpenAICompatibleConfig } from "@smm/types"
import {
  createDefaultLlmTranslatorFieldsValue,
  isLlmTranslatorFieldsValid,
  maskApiKey,
  resolveLlmTranslatorPayload,
} from "./llmTranslatorFields"

const complete: OpenAICompatibleConfig = {
  name: "DeepSeek",
  baseURL: "https://api.deepseek.com",
  apiKey: "sk-secret-key",
  model: "deepseek-v4-flash",
}

const incomplete: OpenAICompatibleConfig = {
  name: "OpenAI",
  baseURL: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
}

describe("llmTranslatorFields", () => {
  it("defaults to configured when selected provider is complete", () => {
    const v = createDefaultLlmTranslatorFieldsValue([complete, incomplete], "DeepSeek")
    expect(v.mode).toBe("configured")
    expect(v.providerName).toBe("DeepSeek")
  })

  it("honors stored custom mode", () => {
    const v = createDefaultLlmTranslatorFieldsValue([complete], "DeepSeek", { mode: "custom" })
    expect(v.mode).toBe("custom")
  })

  it("validates custom by apiKey only", () => {
    expect(
      isLlmTranslatorFieldsValid(
        { mode: "custom", providerName: "", custom: { apiKey: "k", apiBase: "", model: "" } },
        [],
      ),
    ).toBe(true)
    expect(
      isLlmTranslatorFieldsValid(
        { mode: "custom", providerName: "", custom: { apiKey: "  ", apiBase: "x", model: "y" } },
        [],
      ),
    ).toBe(false)
  })

  it("validates configured provider completeness", () => {
    expect(
      isLlmTranslatorFieldsValid(
        {
          mode: "configured",
          providerName: "OpenAI",
          custom: { apiKey: "", apiBase: "", model: "" },
        },
        [incomplete],
      ),
    ).toBe(false)
    expect(
      isLlmTranslatorFieldsValid(
        {
          mode: "configured",
          providerName: "DeepSeek",
          custom: { apiKey: "", apiBase: "", model: "" },
        },
        [complete],
      ),
    ).toBe(true)
  })

  it("resolves configured payload from provider", () => {
    const payload = resolveLlmTranslatorPayload(
      {
        mode: "configured",
        providerName: "DeepSeek",
        custom: { apiKey: "ignored", apiBase: "", model: "" },
      },
      [complete],
    )
    expect(payload).toEqual({
      apiKey: "sk-secret-key",
      apiBase: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    })
  })

  it("resolves custom payload omitting empty optional fields", () => {
    expect(
      resolveLlmTranslatorPayload(
        {
          mode: "custom",
          providerName: "",
          custom: { apiKey: " k ", apiBase: "", model: " m " },
        },
        [],
      ),
    ).toEqual({ apiKey: "k", model: "m" })
  })

  it("masks api keys", () => {
    expect(maskApiKey("sk-secret-key")).toMatch(/key$/)
    expect(maskApiKey("ab")).toBe("••••")
  })
})
