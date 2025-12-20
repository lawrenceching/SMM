import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { FileIcon, FolderIcon, FolderOpen, MoreHorizontal } from "lucide-react"
import { useMemo } from "react"

interface File {
    /**
     * The relative path of the file, in POSIX format. Relative to the media folder.
     */
    path: string;
}

interface LocalFilesPanelProps {
    files: File[];
    /**
     * Absolute path in POSIX format
     */
    mediaFolderPath: string;
    onFileAction?: (action: string, file: File) => void;
}

interface FileProps {
    /**
     * Relative path of this file, in POSIX format. Relative to the media folder.
     */
    path: string;
    icon: React.ReactNode;
}

function FileItem({path, icon}: FileProps) {

    return <div className="flex items-center gap-2 h-[40px]">
        <div>
            {icon}
        </div>
        <div>
            <span>{path}</span>
        </div>
    </div>

}


function LocalFilesPanel({ files, onFileAction, mediaFolderPath }: LocalFilesPanelProps) {

    const filesProps: FileProps[] = useMemo(() => {

        return files.map((file) => {
            return {
                path: file.path.replace(mediaFolderPath + "/", ""),
                icon: <FileIcon className="h-6 w-6 text-muted-foreground" />,
            }
        })

    }, [files])

    const handleAction = (action: string, file: File) => {
        if (onFileAction) {
            onFileAction(action, file);
        }
    };

    const getFileName = (path: string) => {
        return path.split("/").pop() || path;
    };

    const getFileExtension = (path: string) => {
        return path.split(".").pop()?.toLowerCase() || "";
    };

    const isImageOrVideo = (path: string) => {
        const ext = getFileExtension(path);
        const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
        const videoExts = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v"];
        return imageExts.includes(ext) || videoExts.includes(ext);
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1">
                {
                    filesProps.map((file) => (
                        <ContextMenu key={file.path}>
                            <ContextMenuTrigger asChild>
                                <FileItem path={file.path} icon={file.icon} />
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem onClick={() => handleAction("open", file)}>
                                    Open in Explorer
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleAction("rename", file)}>
                                    Rename
                                </ContextMenuItem>
                                <ContextMenuItem
                                    variant="destructive"
                                    onClick={() => handleAction("delete", file)}
                                >
                                    Delete
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleAction("properties", file)}>
                                    Properties
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    ))
                }
            </ScrollArea>
        </div>
    )
}

export default LocalFilesPanel