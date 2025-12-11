import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"

const files: string[] = [
    "file1.txt",
    "file2.txt",
    "file3.txt",
    "file4.txt",
    "file5.txt",
    "file6.txt",
    "file7.txt",
    "file8.txt",
    "file9.txt",
    "file10.txt",
]
export function FileList() {

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