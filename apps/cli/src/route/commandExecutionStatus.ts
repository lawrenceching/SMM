import type { Hono } from 'hono';
import { isCommandExecutionId } from './commandLog';
import {
  getCommandExecutionRegistryStatus,
  type CommandExecutionStatus,
} from './commandExecutionRegistry';
import { readCommandExecutionStatusFromLog } from './commandExecutionLogStatus';

export async function resolveCommandExecutionStatus(
  executionId: string,
): Promise<CommandExecutionStatus> {
  const fromRegistry = getCommandExecutionRegistryStatus(executionId);
  if (fromRegistry) return fromRegistry;

  const fromLog = await readCommandExecutionStatusFromLog(executionId);
  if (fromLog) return fromLog;

  return {
    executionId,
    found: false,
    phase: 'unknown',
  };
}

export function handleCommandExecutionStatus(app: Hono) {
  app.get('/api/command-execution/:executionId', async (c) => {
    const executionId = c.req.param('executionId') ?? '';
    if (!isCommandExecutionId(executionId)) {
      return c.json({ error: 'Invalid execution id' }, 400);
    }

    const status = await resolveCommandExecutionStatus(executionId);
    return c.json(status);
  });
}
