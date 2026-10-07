import { rpc, unwrapJson } from '@/lib/rpc'

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
  const resp = await rpc.api['command-execution'][':executionId'].$get({
    param: { executionId },
  })
  const body = await unwrapJson<Awaited<ReturnType<typeof resp.json>>>(resp)
  if ('error' in body) throw new Error(body.error)
  return body
}
