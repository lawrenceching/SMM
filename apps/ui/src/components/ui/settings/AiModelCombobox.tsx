"use client"

import { AiSettingsStringCombobox } from "./AiSettingsStringCombobox"

export interface AiModelComboboxProps {
  value: string
  onValueChange: (value: string) => void
  modelOptions: string[]
  placeholder?: string
  id?: string
  "data-testid"?: string
  invalid?: boolean
}

export function AiModelCombobox({
  value,
  onValueChange,
  modelOptions,
  ...rest
}: AiModelComboboxProps) {
  return (
    <AiSettingsStringCombobox
      value={value}
      onValueChange={onValueChange}
      options={modelOptions}
      {...rest}
    />
  )
}
