import type { OpenAICompatibleConfig } from "@smm/types"

export type LlmTranslatorSourceMode = "configured" | "custom"

interface LlmTranslatorCustomFields {
  apiKey: string
  apiBase: string
  model: string
}

export interface LlmTranslatorFieldsValue {
  mode: LlmTranslatorSourceMode
  /** Provider `name` when mode is `configured`. */
  providerName: string
  custom: LlmTranslatorCustomFields
}

export interface LlmTranslatorResolvedPayload {
  apiKey: string
  apiBase?: string
  model?: string
}

function trim(s: string | undefined): string {
  return typeof s === "string" ? s.trim() : ""
}

export function findAiProviderByName(
  providers: OpenAICompatibleConfig[] | undefined,
  name: string,
): OpenAICompatibleConfig | undefined {
  const n = trim(name)
  if (!n || !providers?.length) return undefined
  return providers.find((p) => trim(p.name) === n)
}

function isAiProviderComplete(provider: OpenAICompatibleConfig | undefined): boolean {
  if (!provider) return false
  return Boolean(trim(provider.apiKey) && trim(provider.baseURL) && trim(provider.model))
}

export function createDefaultLlmTranslatorFieldsValue(
  providers: OpenAICompatibleConfig[] | undefined,
  selectedAIProvider?: string,
  stored?: { mode?: LlmTranslatorSourceMode; providerName?: string },
): LlmTranslatorFieldsValue {
  const list = providers ?? []
  const preferredName = trim(stored?.providerName) || trim(selectedAIProvider)
  const preferred = findAiProviderByName(list, preferredName)
  const firstNamed = list.find((p) => trim(p.name))
  const providerName = preferred
    ? trim(preferred.name)
    : firstNamed
      ? trim(firstNamed.name)
      : ""

  const storedMode = stored?.mode
  let mode: LlmTranslatorSourceMode = "custom"
  if (storedMode === "configured" || storedMode === "custom") {
    mode = storedMode
  } else if (providerName && isAiProviderComplete(findAiProviderByName(list, providerName))) {
    mode = "configured"
  }

  if (mode === "configured" && !providerName) {
    mode = "custom"
  }

  return {
    mode,
    providerName,
    custom: { apiKey: "", apiBase: "", model: "" },
  }
}

export function isLlmTranslatorFieldsValid(
  value: LlmTranslatorFieldsValue,
  providers: OpenAICompatibleConfig[] | undefined,
): boolean {
  if (value.mode === "custom") {
    return trim(value.custom.apiKey).length > 0
  }
  const provider = findAiProviderByName(providers, value.providerName)
  return isAiProviderComplete(provider)
}

export function resolveLlmTranslatorPayload(
  value: LlmTranslatorFieldsValue,
  providers: OpenAICompatibleConfig[] | undefined,
): LlmTranslatorResolvedPayload | null {
  if (!isLlmTranslatorFieldsValid(value, providers)) return null

  if (value.mode === "custom") {
    const apiKey = trim(value.custom.apiKey)
    const apiBase = trim(value.custom.apiBase)
    const model = trim(value.custom.model)
    return {
      apiKey,
      ...(apiBase ? { apiBase } : {}),
      ...(model ? { model } : {}),
    }
  }

  const provider = findAiProviderByName(providers, value.providerName)!
  return {
    apiKey: trim(provider.apiKey),
    apiBase: trim(provider.baseURL),
    model: trim(provider.model),
  }
}

/** Mask secret for read-only display (keeps last 4 chars when long enough). */
export function maskApiKey(apiKey: string): string {
  const k = trim(apiKey)
  if (!k) return ""
  if (k.length <= 4) return "••••"
  return `${"•".repeat(Math.min(8, k.length - 4))}${k.slice(-4)}`
}
