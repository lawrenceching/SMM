import { FloatingPrompt, type FloatingPromptProps, type FloatingPromptOption } from "./FloatingPrompt"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface RuleBasedRenameFilePromptProps extends Omit<FloatingPromptProps, 'mode' | 'children' | 'options' | 'selectedValue' | 'onValueChange' | 'confirmLabel' | 'cancelLabel' | 'isConfirmButtonDisabled' | 'isConfirmDisabled'> {
  /**
   * Options for the naming rule dropdown
   */
  namingRuleOptions: FloatingPromptOption[]
  /**
   * Currently selected naming rule value
   */
  selectedNamingRule: string
  /**
   * Callback when the naming rule selection changes
   */
  onNamingRuleChange: (value: string) => void
}

/**
 * RuleBasedRenameFilePrompt component built on top of FloatingPrompt.
 * Provides a dropdown for selecting naming rules (plex/emby) for renaming files.
 */
export function RuleBasedRenameFilePrompt({
  namingRuleOptions,
  selectedNamingRule,
  onNamingRuleChange,
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  ...promptProps
}: RuleBasedRenameFilePromptProps) {
  const { t } = useTranslation('components')
  const defaultPlaceholder = t('toolbar.selectPlaceholder')

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      mode="manual"
      className={cn(className)}
    >
      <Select value={selectedNamingRule} onValueChange={onNamingRuleChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={defaultPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {namingRuleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FloatingPrompt>
  )
}
