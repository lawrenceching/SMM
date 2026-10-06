import { broadcast } from "../utils/socketIO";
import { USER_CONFIG_FOLDER_RENAMED_EVENT, type UserConfigFolderRenamedEventData } from "@smm/types/event-types";

export function broadcastUserConfigFolderRenamedEvent(data: UserConfigFolderRenamedEventData) {
    broadcast({
        event: USER_CONFIG_FOLDER_RENAMED_EVENT,
        data: data
    });
}