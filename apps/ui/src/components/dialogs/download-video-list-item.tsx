import type { ReactNode } from "react"

export interface ListItemProps {
  /** Shown next to the checkbox (episode title or video URL). */
  label: ReactNode
  checked: boolean
  onToggle: () => void
  disabled?: boolean
  listItemTestId?: string
  checkboxTestId?: string
  /** Applied to the label span; e.g. `break-all` for long URLs. */
  labelClassName?: string
}

/**
 * Shared row for download dialog episode and collection lists: checkbox + label.
 */
export function ListItem({
  label,
  checked,
  onToggle,
  disabled,
  listItemTestId,
  checkboxTestId,
  labelClassName = "leading-snug",
}: ListItemProps) {
  return (
    <li data-testid={listItemTestId}>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          data-testid={checkboxTestId}
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          checked={checked}
          onChange={() => {
            onToggle()
          }}
          disabled={disabled}
        />
        <span className={labelClassName}>{label}</span>
      </label>
    </li>
  )
}
