import { useConfig } from "@/components/config-provider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function RenameRuleSettings() {
  const { userConfig } = useConfig()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Rename Rules</h2>
          <p className="text-muted-foreground mb-6">
            Configure file renaming rules for media files
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="selected-rename-rule">Selected Rename Rule</Label>
          <Select defaultValue={userConfig.selectedRenameRule || ''}>
            <SelectTrigger id="selected-rename-rule">
              <SelectValue placeholder="Select a rename rule" />
            </SelectTrigger>
            <SelectContent>
              {userConfig.renameRules?.map((rule) => (
                <SelectItem key={rule.name} value={rule.name}>
                  {rule.name}
                </SelectItem>
              )) || (
                <SelectItem value="none">No rules available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {userConfig.renameRules && userConfig.renameRules.length > 0 ? (
            <div className="space-y-2">
              <Label>Available Rules</Label>
              <div className="space-y-2">
                {userConfig.renameRules.map((rule) => (
                  <div
                    key={rule.name}
                    className="p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <div className="font-medium">{rule.name}</div>
                    {rule.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {rule.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rename rules configured. Click "Add Rule" to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

