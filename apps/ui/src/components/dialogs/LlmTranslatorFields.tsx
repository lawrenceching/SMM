import { useMemo } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import {
  findAiProviderByName,
  maskApiKey,
  type LlmTranslatorFieldsValue,
  type LlmTranslatorSourceMode,
} from "@/lib/llmTranslatorFields"

export interface LlmTranslatorFieldsProps {
  value: LlmTranslatorFieldsValue
  onChange: (next: LlmTranslatorFieldsValue) => void
  disabled?: boolean
  /** Prefix for data-testid attributes (e.g. `subtitle-translation-dialog`). */
  testIdPrefix?: string
}

export function LlmTranslatorFields({
  value,
  onChange,
  disabled = false,
  testIdPrefix = "llm-translator-fields",
}: LlmTranslatorFieldsProps) {
  const { t } = useTranslation("components")
  const { userConfig } = useConfig()
  const providers = useMemo(() => userConfig.aiProviders ?? [], [userConfig.aiProviders])
  const namedProviders = useMemo(
    () => providers.filter((p) => typeof p.name === "string" && p.name.trim() !== ""),
    [providers],
  )

  const selectedProvider = findAiProviderByName(providers, value.providerName)
  const tid = (suffix: string) => `${testIdPrefix}-${suffix}`

  const setMode = (mode: LlmTranslatorSourceMode) => {
    onChange({ ...value, mode })
  }

  const setProviderName = (providerName: string) => {
    onChange({ ...value, providerName })
  }

  const setCustom = (patch: Partial<LlmTranslatorFieldsValue["custom"]>) => {
    onChange({ ...value, custom: { ...value.custom, ...patch } })
  }

  return (
    <div className="grid gap-3 rounded-md border p-3" data-testid={tid("root")}>
      <div className="grid gap-2">
        <Label>{t("llmTranslatorFields.source")}</Label>
        <RadioGroup
          value={value.mode}
          onValueChange={(v) => setMode(v as LlmTranslatorSourceMode)}
          className="flex items-center gap-4"
          disabled={disabled}
          data-testid={tid("source")}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem
              value="configured"
              id={tid("source-configured")}
              disabled={disabled || namedProviders.length === 0}
              data-testid={tid("source-configured")}
            />
            <Label htmlFor={tid("source-configured")} className="cursor-pointer font-normal">
              {t("llmTranslatorFields.configured")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem
              value="custom"
              id={tid("source-custom")}
              disabled={disabled}
              data-testid={tid("source-custom")}
            />
            <Label htmlFor={tid("source-custom")} className="cursor-pointer font-normal">
              {t("llmTranslatorFields.custom")}
            </Label>
          </div>
        </RadioGroup>
        {namedProviders.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid={tid("no-providers")}>
            {t("llmTranslatorFields.noProvidersHint")}
          </p>
        ) : null}
      </div>

      {value.mode === "configured" ? (
        <>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.provider")}</Label>
            <Select
              value={value.providerName || undefined}
              onValueChange={setProviderName}
              disabled={disabled || namedProviders.length === 0}
            >
              <SelectTrigger data-testid={tid("provider")}>
                <SelectValue placeholder={t("llmTranslatorFields.providerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {namedProviders.map((p) => (
                  <SelectItem key={p.name!} value={p.name!.trim()}>
                    {p.name!.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.apiBase")}</Label>
            <Input
              value={selectedProvider?.baseURL ?? ""}
              readOnly
              disabled
              data-testid={tid("api-base-readonly")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.model")}</Label>
            <Input
              value={selectedProvider?.model ?? ""}
              readOnly
              disabled
              data-testid={tid("model-readonly")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.apiKey")}</Label>
            <Input
              value={maskApiKey(selectedProvider?.apiKey ?? "")}
              readOnly
              disabled
              data-testid={tid("api-key-readonly")}
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.apiKey")}</Label>
            <Input
              type="password"
              value={value.custom.apiKey}
              onChange={(e) => setCustom({ apiKey: e.target.value })}
              disabled={disabled}
              data-testid={tid("api-key")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.apiBase")}</Label>
            <Input
              value={value.custom.apiBase}
              onChange={(e) => setCustom({ apiBase: e.target.value })}
              disabled={disabled}
              data-testid={tid("api-base")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("llmTranslatorFields.model")}</Label>
            <Input
              value={value.custom.model}
              onChange={(e) => setCustom({ model: e.target.value })}
              disabled={disabled}
              data-testid={tid("model")}
            />
          </div>
        </>
      )}
    </div>
  )
}
