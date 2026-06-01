"use client"

import { RadixDialogCompatibleCombobox } from "@/components/RadixDialogCompatibleCombobox"

export interface AiSettingsStringComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  placeholder?: string
  id?: string
  "data-testid"?: string
  invalid?: boolean
  emptyLabel?: string
  className?: string
}

/**
 * Creatable string combobox for AI settings (provider name / model).
 * Uses {@link RadixDialogCompatibleCombobox} for Radix Dialog compatibility.
 */
export function AiSettingsStringCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  "data-testid": dataTestId,
  invalid,
  emptyLabel = "No matches",
  className,
}: AiSettingsStringComboboxProps) {
  return (
    <RadixDialogCompatibleCombobox
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      id={id}
      data-testid={dataTestId}
      invalid={invalid}
      emptyLabel={emptyLabel}
      className={className}
    />
  )
}
