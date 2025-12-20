import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"

interface FileListProps {
    files: string[]
}

/**
 * @deprecated("Use LocalFilesPanel instead")
 * @param param0 
 * @returns 
 */
export function FileList({ files }: FileListProps) {

    return (
        <div>
            {
                files.map((file) => (
                    <div key={file}>
                        <ContextMenu>
                            <ContextMenuTrigger>
                                <div>
                                    {file}
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem>Profile</ContextMenuItem>
                                <ContextMenuItem>Billing</ContextMenuItem>
                                <ContextMenuItem>Team</ContextMenuItem>
                                <ContextMenuItem>Subscription</ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    </div>
                ))
            }
        </div>
    )

}