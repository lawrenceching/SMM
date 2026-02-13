import { broadcast } from "../utils/socketIO";

export function ping() {
    broadcast({
        event: 'ping',
        data: {
            timestamp: Date.now()
        }
    });
}
