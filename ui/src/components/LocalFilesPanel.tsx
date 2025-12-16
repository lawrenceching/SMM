import React from "react"
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
import { FileIcon, FolderOpen, MoreHorizontal } from "lucide-react"

interface File {
    /**
     * The relative path of the file, in POSIX format. Relative to the media folder.
     */
    path: string;

    /**
     * Thumbnail is available when the file is an image or video
     */
    thumbnail?: string;
}

interface LocalFilesPanelProps {
    files: File[];
    onFileAction?: (action: string, file: File) => void;
}

function LocalFilesPanel({ files, onFileAction }: LocalFilesPanelProps) {
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
            <div className="flex items-center justify-between p-4 border-b">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Local Files</h2>
                    <p className="text-sm text-muted-foreground">
                        {files.length} {files.length === 1 ? "file" : "files"}
                    </p>
                </div>
                <Button variant="outline" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Open Folder
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">Preview</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                    No files found
                                </TableCell>
                            </TableRow>
                        ) : (
                            files.map((file) => (
                                <ContextMenu key={file.path}>
                                    <ContextMenuTrigger asChild>
                                        <TableRow className="cursor-pointer">
                                            <TableCell>
                                                <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                                                    {file.thumbnail ? (
                                                        <img
                                                            src={file.thumbnail}
                                                            alt={getFileName(file.path)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : isImageOrVideo(file.path) ? (
                                                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                                                    ) : (
                                                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="truncate max-w-[300px]">
                                                        {getFileName(file.path)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                        {file.path}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs uppercase font-medium text-muted-foreground">
                                                    {getFileExtension(file.path) || "File"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAction("more", file);
                                                    }}
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
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
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    )
}

export default LocalFilesPanel