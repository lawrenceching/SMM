import type { UIMessage } from "ai";
import { folderSwitchNotice } from "./folderSwitchNotice";
import { injectAssistantBeforeLastUserUIMessage } from "./injectAssistantBeforeLastUserUIMessage";

/**
 * Tracks selected-folder path last reflected in a chat request vs. pending UI change.
 * Pending notice is consumed on the next submit-message send (see prepareSendMessagesRequest).
 */
let lastSentPath: string | undefined;

let pendingTargetPath: string | null = null;

/** Call when UI selected folder path (metadata) changes. */
/** After clearing chat: align tracking with current folder so no stale pending inject. */
export function resetFolderSwitchTrackingForCurrentPath(currentPath: string): void {
    lastSentPath = currentPath;
    pendingTargetPath = null;
}

export function onSelectedFolderPathChanged(currentPath: string): void {
    if (lastSentPath === undefined) {
        lastSentPath = currentPath;
        return;
    }
    if (currentPath === lastSentPath) {
        pendingTargetPath = null;
        return;
    }
    pendingTargetPath = currentPath;
}

/**
 * If a folder change is pending, splices an assistant notice before the last user message,
 * updates last-sent path, and clears pending. Otherwise returns `messages` unchanged.
 */
export function injectPendingFolderNoticeIntoMessages(
    messages: UIMessage[],
): UIMessage[] {
    if (pendingTargetPath === null) {
        return messages;
    }
    const target = pendingTargetPath;
    pendingTargetPath = null;
    lastSentPath = target;
    const text = folderSwitchNotice(target);
    return injectAssistantBeforeLastUserUIMessage(messages, text);
}
