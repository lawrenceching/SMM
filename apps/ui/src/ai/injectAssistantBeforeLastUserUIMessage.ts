import type { UIMessage } from "ai";
import { generateId } from "ai";

/** Inserts a synthetic assistant text message immediately before the last user message. */
export function injectAssistantBeforeLastUserUIMessage(
    messages: UIMessage[],
    noticeText: string,
): UIMessage[] {
    const copy = [...messages];
    let lastUserIdx = -1;
    for (let i = copy.length - 1; i >= 0; i--) {
        const msg = copy[i];
        if (msg?.role === "user") {
            lastUserIdx = i;
            break;
        }
    }
    const synthetic: UIMessage = {
        id: generateId(),
        role: "assistant",
        parts: [{ type: "text", text: noticeText }],
    };
    if (lastUserIdx === -1) {
        copy.push(synthetic);
    } else {
        copy.splice(lastUserIdx, 0, synthetic);
    }
    return copy;
}
