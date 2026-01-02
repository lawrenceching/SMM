import { broadcast } from "../utils/socketIO";
import { AskForRenameFilesConfirmation } from "@core/event-types";

export interface Task {
    mediaFolderPath: string;
    files: {
        from: string;
        to: string;
    }[];
}
const cache: Record<string, Task> = {};


/**
 * 
 * @param mediaFolderPath The absolute path of the media folder, it can be POSIX format or Windows format
 * @return the id of task
 */
export function beginRenameFilesTask(mediaFolderPath: string): string {
    const id = crypto.randomUUID();
    cache[id] = {
        mediaFolderPath,
        files: [],
    };


    const data: AskForRenameFilesConfirmation.BeginRequestData = {
        mediaFolderPath,
    }

    broadcast({
            event: AskForRenameFilesConfirmation.beginEvent,
            data,
        }
    )

    return id;

}

/**
 * Add a rename file to task
 * @param id The id of task
 * @param from The source file path
 * @param to The destination file path
 */
export function addRenameFileToTask(id: string, from: string, to: string) {
    if (!cache[id]) {
        throw new Error(`Task with id ${id} not found`);
    }
    cache[id].files.push({ from, to });

    const data: AskForRenameFilesConfirmation.AddFileResponseData = {
        from,
        to,
    }

    broadcast({
        event: AskForRenameFilesConfirmation.addFileEvent,
        data,
    }
    )
}

/**
 * Get a task by ID
 * @param id The id of task
 * @return The task or undefined if not found
 */
export function getTask(id: string): Task | undefined {
    return cache[id];
}

/**
 * End a rename files task and remove it from cache
 * @param id The id of task
 */
export function endRenameFilesTask(id: string) {
    if (!cache[id]) {
        throw new Error(`Task with id ${id} not found`);
    }
    
    // Remove task from cache
    delete cache[id];
    
    const data: AskForRenameFilesConfirmation.EndRequestData = {
        
    }

    broadcast({
        event: AskForRenameFilesConfirmation.endEvent,
        data,
    }
    )
}