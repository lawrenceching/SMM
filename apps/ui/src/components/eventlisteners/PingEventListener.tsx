import { useRef } from "react";
import { useMount, useUnmount } from "react-use";

export function PingEventListener() {

    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {

        eventListener.current = (event) => {
            console.log('Socket event:', event.detail);
            // 处理事件逻辑
          };

        document.addEventListener('socket.io_ping', eventListener.current);

    })

    useUnmount(() => {

        if (eventListener.current) {
            document.removeEventListener('socket.io_ping', eventListener.current);
        }
        
    })

    return (
        <></>
    )
}