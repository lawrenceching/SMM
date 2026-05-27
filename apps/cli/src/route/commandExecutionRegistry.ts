export type CommandExecutionPhase = 'unknown' | 'running' | 'finished';

export type CommandExecutionOutcome = 'success' | 'failure';

export interface CommandExecutionStatus {
  executionId: string;
  found: boolean;
  phase: CommandExecutionPhase;
  outcome?: CommandExecutionOutcome;
  exitCode?: number | null;
  signal?: string | null;
  systemNote?: string;
}

interface RegistryEntry {
  command: string;
  phase: 'running' | 'finished';
  outcome?: CommandExecutionOutcome;
  exitCode?: number | null;
  signal?: string | null;
  systemNote?: string;
}

const entries = new Map<string, RegistryEntry>();

export function markCommandExecutionRunning(executionId: string, command: string): void {
  entries.set(executionId, { command, phase: 'running' });
}

export function markCommandExecutionFinished(
  executionId: string,
  input: {
    outcome: CommandExecutionOutcome;
    exitCode?: number | null;
    signal?: string | null;
    systemNote?: string;
  },
): void {
  const prev = entries.get(executionId);
  entries.set(executionId, {
    command: prev?.command ?? 'unknown',
    phase: 'finished',
    outcome: input.outcome,
    exitCode: input.exitCode,
    signal: input.signal,
    systemNote: input.systemNote,
  });
}

export function getCommandExecutionRegistryStatus(executionId: string): CommandExecutionStatus | null {
  const entry = entries.get(executionId);
  if (!entry) return null;
  if (entry.phase === 'running') {
    return {
      executionId,
      found: true,
      phase: 'running',
    };
  }
  return {
    executionId,
    found: true,
    phase: 'finished',
    outcome: entry.outcome,
    exitCode: entry.exitCode,
    signal: entry.signal,
    systemNote: entry.systemNote,
  };
}

/** @internal test helper */
export function clearCommandExecutionRegistry(): void {
  entries.clear();
}
