import type { WebSocketMessage } from "../socketIO/types.ts";

/**
 * No-op broadcast used when the host does not provide Socket.IO
 * (e.g. isolated tests). Plan-ready notifications are best-effort.
 */
export function defaultBroadcast(_message: WebSocketMessage): void {}
