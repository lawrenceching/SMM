import { broadcast } from "../utils/socketIO";
import { USER_CONFIG_FOLDER_RENAMED_EVENT, USER_CONFIG_UPDATED_EVENT, type UserConfigFolderRenamedEventData, type UserConfigUpdatedEventData } from "@core/event-types";

export function broadcastUserConfigUpdatedEvent(data: UserConfigUpdatedEventData) {
    broadcast({
        event: USER_CONFIG_UPDATED_EVENT,
        data: data
    });
}

export function broadcastUserConfigFolderRenamedEvent(data: UserConfigFolderRenamedEventData) {
    broadcast({
        event: USER_CONFIG_FOLDER_RENAMED_EVENT,
        data: data
    });
}