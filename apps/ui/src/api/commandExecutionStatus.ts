import { apiFetch } from '@/lib/apiFetch'

type CommandExecutionPhase = 'unknown' | 'running' | 'finished'

type CommandExecutionOutcome = 'success' | 'failure'

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
  // Relative `/api` so Vite proxy + authenticated fetch apply in `pnpm dev`.
  const res = await apiFetch(
    `/api/command-execution/${encodeURIComponent(executionId)}`,
    { credentials: 'same-origin' },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`)
  }
  return JSON.parse(text) as CommandExecutionStatusResponse
}
