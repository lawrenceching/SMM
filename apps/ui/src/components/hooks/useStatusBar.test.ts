import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStatusBar, mapWebSocketStatusToConnectionStatus } from './useStatusBar'
import type { WebSocketStatus } from '@/hooks/useWebSocket'
import type { ConnectionStatus } from '../ConnectionStatusIndicator'

vi.mock('@/providers/config-provider', () => ({
  useConfig: vi.fn(),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

import { useConfig } from '@/providers/config-provider'
import { useWebSocket } from '@/hooks/useWebSocket'

const mockUseConfig = useConfig as ReturnType<typeof vi.fn>
const mockUseWebSocket = useWebSocket as ReturnType<typeof vi.fn>

describe('mapWebSocketStatusToConnectionStatus', () => {
  it('maps connected to connected', () => {
    expect(mapWebSocketStatusToConnectionStatus('connected' as WebSocketStatus)).toBe('connected')
  })

  it('maps connecting to connecting', () => {
    expect(mapWebSocketStatusToConnectionStatus('connecting' as WebSocketStatus)).toBe('connecting')
  })

  it('maps disconnected to disconnected', () => {
    expect(mapWebSocketStatusToConnectionStatus('disconnected' as WebSocketStatus)).toBe('disconnected')
  })

  it('maps error to disconnected', () => {
    expect(mapWebSocketStatusToConnectionStatus('error' as WebSocketStatus)).toBe('disconnected')
  })

  it('maps unknown status to disconnected', () => {
    expect(mapWebSocketStatusToConnectionStatus('unknown' as WebSocketStatus)).toBe('disconnected')
  })
})

describe('useStatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns connectionStatus and version from hooks when no overrides', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'connected' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.connectionStatus).toBe('connected')
    expect(result.current.version).toBe('1.0.0')
  })

  it('returns connectionStatus override when provided', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'connected' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar({
      connectionStatusOverride: 'disconnected' as ConnectionStatus,
    }))

    expect(result.current.connectionStatus).toBe('disconnected')
    expect(result.current.version).toBe('1.0.0')
  })

  it('returns version override when provided', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'connected' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar({
      versionOverride: '2.0.0',
    }))

    expect(result.current.connectionStatus).toBe('connected')
    expect(result.current.version).toBe('2.0.0')
  })

  it('returns both overrides when provided', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'connected' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar({
      connectionStatusOverride: 'connecting' as ConnectionStatus,
      versionOverride: '3.0.0',
    }))

    expect(result.current.connectionStatus).toBe('connecting')
    expect(result.current.version).toBe('3.0.0')
  })

  it('maps WebSocket status to connection status', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'connecting' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.connectionStatus).toBe('connecting')
  })

  it('maps WebSocket error to disconnected', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'error' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.connectionStatus).toBe('disconnected')
  })

  it('maps WebSocket disconnected to disconnected', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: '1.0.0' },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'disconnected' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.connectionStatus).toBe('disconnected')
  })

  it('handles missing appConfig version', () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: undefined as any },
    } as any)
    mockUseWebSocket.mockReturnValue({ status: 'connected' as WebSocketStatus })

    const { result } = renderHook(() => useStatusBar())

    expect(result.current.version).toBeUndefined()
  })
})
