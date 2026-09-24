/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { useWebSocketStore, type WebSocketStatus } from "@/stores/webSocketStore"

export type { WebSocketStatus }

export interface WebSocketMessage {
  event: string
  data?: any
  requestId?: string
}

export interface UseWebSocketReturn {
  status: WebSocketStatus
  connect: () => void
  disconnect: () => void
  send: (message: WebSocketMessage) => void
}

type WebSocketEventListener = (message: WebSocketMessage) => void

const webSocketEventListeners = new Set<WebSocketEventListener>()

/** Process-wide Socket.IO client — at most one connection for the UI. */
let sharedSocket: Socket | null = null
let sharedSocketRefCount = 0
let sharedHandlersAttached = false

function publishStatus(status: WebSocketStatus): void {
  useWebSocketStore.getState().setStatus(status)
}

/**
 * Register a Socket.IO event handler.
 * The handler receives the full message object, including event and data.
 */
export function useWebSocketEvent(handler: (message: WebSocketMessage) => void): void {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const listener: WebSocketEventListener = (message) => {
      handlerRef.current(message)
    }

    webSocketEventListeners.add(listener)
    return () => {
      webSocketEventListeners.delete(listener)
    }
  }, [])
}

export function sendAcknowledgement(message: WebSocketMessage, response: any): void {
  console.log("[Socket.IO][DEBUG] sendAcknowledgement called", {
    event: message.event,
    response,
    hasCallback: !!(message as any)._socketCallback,
    callbackType: typeof (message as any)._socketCallback,
  })

  const callback = (message as any)._socketCallback
  if (callback && typeof callback === "function") {
    try {
      console.log("[Socket.IO][DEBUG] Calling callback with response:", response)
      callback(response)
      console.log("[Socket.IO][DEBUG] Acknowledgement sent successfully:", response)
    } catch (error) {
      console.error("[Socket.IO][DEBUG] Error sending acknowledgement:", error)
    }
  } else {
    console.warn("[Socket.IO][DEBUG] No callback available for acknowledgement. Message:", message)
  }
}

function createUUID(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateClientId(): string {
  const key = "clientId"
  try {
    const existing = localStorage.getItem(key)
    if (existing && existing.trim().length > 0) {
      return existing
    }
    const created = createUUID()
    localStorage.setItem(key, created)
    return created
  } catch {
    return createUUID()
  }
}

function attachSharedHandlers(socket: Socket, clientId: string): void {
  if (sharedHandlersAttached) {
    return
  }
  sharedHandlersAttached = true

  socket.on("connect", () => {
    console.log("[Socket.IO] Connected")
    publishStatus("connected")
  })

  socket.on("hello", () => {
    console.log("[Socket.IO] Received hello event, sending userAgent")
    socket.emit("userAgent", {
      userAgent: navigator.userAgent,
      clientId,
    })
    console.log("[Socket.IO] Sent userAgent:", navigator.userAgent)
  })

  socket.onAny((event: string, ...args: any[]) => {
    console.log("[Socket.IO][DEBUG] Received event:", event, "args count:", args.length, "args:", args)

    if (
      event === "connect" ||
      event === "disconnect" ||
      event === "connect_error" ||
      event === "hello" ||
      event === "userAgent"
    ) {
      return
    }

    const lastArg = args[args.length - 1]
    const hasCallback = typeof lastArg === "function"
    const callback = hasCallback ? lastArg : undefined
    const data = args[0]

    console.log("[Socket.IO][DEBUG] Event details:", {
      event,
      hasCallback,
      callbackType: typeof callback,
      dataLength: args.length,
      data,
    })

    console.log(`event data: ${JSON.stringify(data)}`)

    const message: WebSocketMessage = {
      event,
      data,
    }

    if (callback) {
      ;(message as any)._socketCallback = callback
      console.log("[Socket.IO][DEBUG] Callback attached to message for event:", event)
    }

    for (const listener of webSocketEventListeners) {
      try {
        listener(message)
      } catch (error) {
        console.error("[Socket.IO] Error in event listener:", error)
      }
    }
  })

  socket.on("disconnect", (reason: string) => {
    console.log("[Socket.IO] Disconnected:", reason)
    publishStatus("disconnected")
  })

  socket.on("connect_error", (error: Error) => {
    console.error("[Socket.IO] Connection error:", error)
    publishStatus("error")
  })
}

function acquireSharedSocket(socketUrl: string, clientId: string): Socket {
  if (sharedSocket) {
    sharedSocketRefCount += 1
    console.log("[Socket.IO] Reusing shared connection", { refCount: sharedSocketRefCount })
    return sharedSocket
  }

  publishStatus("connecting")
  console.log("[Socket.IO] Connecting to:", socketUrl)

  const socket = io(socketUrl, {
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
    path: "/socket.io/",
    autoConnect: true,
  })

  sharedSocket = socket
  sharedSocketRefCount = 1
  attachSharedHandlers(socket, clientId)

  if (socket.connected) {
    publishStatus("connected")
  }

  return socket
}

function releaseSharedSocket(): void {
  sharedSocketRefCount = Math.max(0, sharedSocketRefCount - 1)
  console.log("[Socket.IO] Release shared connection", { refCount: sharedSocketRefCount })

  if (sharedSocketRefCount > 0) {
    return
  }

  if (sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket.removeAllListeners()
    sharedSocket = null
  }
  sharedHandlersAttached = false
  publishStatus("disconnected")
}

/** Test-only: reset module singleton between unit tests. */
export function __resetSharedSocketForTests(): void {
  if (sharedSocket) {
    sharedSocket.removeAllListeners()
    sharedSocket.disconnect()
  }
  sharedSocket = null
  sharedSocketRefCount = 0
  sharedHandlersAttached = false
  publishStatus("disconnected")
}

/**
 * Owns the process-wide Socket.IO connection. Mount at most via SocketBridge in main.
 * Extra callers reuse the same connection (ref-counted) and must not create a second io().
 */
export function useWebSocket(): UseWebSocketReturn {
  const status = useWebSocketStore((s) => s.status)
  const socketRef = useRef<Socket | null>(null)
  const clientIdRef = useRef<string>(getOrCreateClientId())

  const getSocketUrl = useCallback(() => {
    const protocol = window.location.protocol
    const host = window.location.host
    return `${protocol}//${host}`
  }, [])

  const connect = useCallback(() => {
    try {
      const socket = acquireSharedSocket(getSocketUrl(), clientIdRef.current)
      socketRef.current = socket
    } catch (error) {
      console.error("[Socket.IO] Failed to create connection:", error)
      publishStatus("error")
    }
  }, [getSocketUrl])

  const disconnect = useCallback(() => {
    socketRef.current = null
    releaseSharedSocket()
  }, [])

  const send = useCallback((message: WebSocketMessage) => {
    const socket = socketRef.current ?? sharedSocket
    if (socket?.connected) {
      try {
        socket.emit(message.event, message.data)
        console.log("[Socket.IO] Sent message:", message)
      } catch (error) {
        console.error("[Socket.IO] Error sending message:", error)
      }
    } else {
      console.warn("[Socket.IO] Cannot send message: Socket is not connected")
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    status,
    connect,
    disconnect,
    send,
  }
}
