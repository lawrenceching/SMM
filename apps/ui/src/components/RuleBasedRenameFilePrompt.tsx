import { FloatingPrompt, type FloatingPromptProps, type FloatingPromptOption } from "./FloatingPrompt"
import { type RenameRuleName } from "@/lib/renameRules"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface RuleBasedRenameFilePromptProps extends Omit<FloatingPromptProps, 'mode' | 'children' | 'options' | 'selectedValue' | 'onValueChange' | 'confirmLabel' | 'cancelLabel'> {
  /**
   * Options for the naming rule dropdown
   */
  namingRuleOptions: FloatingPromptOption[]
  /**
   * Currently selected naming rule value
   */
  selectedNamingRule: RenameRuleName
  /**
   * Callback when naming rules are selected and ready
   */
  onNamingRulesSelected?: (rule: RenameRuleName) => Promise<void>
  loading?: boolean
}

/**
 * RuleBasedRenameFilePrompt component built on top of FloatingPrompt.
 * Provides a dropdown for selecting naming rules (plex/emby) for renaming files.
 */
export function RuleBasedRenameFilePrompt({
  namingRuleOptions,
  selectedNamingRule,
  onNamingRulesSelected,
  onConfirm,
  onCancel,
  isOpen = false,
  loading = false,
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
      <Select
        value={selectedNamingRule}
        onValueChange={(value) => {
          onNamingRulesSelected?.(value as RenameRuleName)
        }}
        disabled={loading}
      >
        <SelectTrigger
          className="w-[200px]"
          data-testid="rename-naming-rule-select"
        >
          <SelectValue placeholder={defaultPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {namingRuleOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              data-testid={`rename-naming-rule-option-${option.value}`}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FloatingPrompt>
  )
}
