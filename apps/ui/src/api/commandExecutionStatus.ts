import { withDevApiUrl } from '@/api/executeCmd'
import { apiFetch } from '@/lib/apiFetch'

export type CommandExecutionPhase = 'unknown' | 'running' | 'finished'

export type CommandExecutionOutcome = 'success' | 'failure'

export interface CommandExecutionStatusResponse {
  executionId: string
  found: boolean
  phase: CommandExecutionPhase
  outcome?: CommandExecutionOutcome
  exitCode?: number | null
  signal?: string | null
  systemNote?: string
}

export async function fetchCommandExecutionStatus(
  executionId: string,
): Promise<CommandExecutionStatusResponse> {
  const res = await apiFetch(
    withDevApiUrl(`/api/command-execution/${encodeURIComponent(executionId)}`),
    { credentials: 'same-origin' },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`)
  }
  return JSON.parse(text) as CommandExecutionStatusResponse
}
