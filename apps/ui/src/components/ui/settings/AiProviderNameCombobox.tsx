"use client"

import { COMMON_AI_PROVIDER_NAMES } from "@/lib/ai-provider-presets"
import { AiSettingsStringCombobox } from "./AiSettingsStringCombobox"

export interface AiProviderNameComboboxProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  id?: string
  "data-testid"?: string
  invalid?: boolean
}

export function AiProviderNameCombobox({
  value,
  onValueChange,
  ...rest
}: AiProviderNameComboboxProps) {
  return (
    <AiSettingsStringCombobox
      value={value}
      onValueChange={onValueChange}
      options={COMMON_AI_PROVIDER_NAMES}
      {...rest}
    />
  )
}
