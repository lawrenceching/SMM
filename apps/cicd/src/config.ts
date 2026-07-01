import { z } from 'zod';

export const BackgroundTaskSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  delayMs: z.number().int().nonnegative().default(0),
});

export const TaskSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const HookSchema = TaskSchema;

export const ConfigSchema = z.object({
  name: z.string().min(1),
  env: z.record(z.string(), z.string()).optional(),
  background: z.array(BackgroundTaskSchema).default([]),
  tasks: z.array(TaskSchema).min(1),
  afterEach: z.array(HookSchema).default([]),
  outputDir: z.string().default('./artifacts/cicd'),
  stopOnFailure: z.boolean().default(true),
  keepRawTimeline: z.boolean().default(true),
});

export type BackgroundTask = z.infer<typeof BackgroundTaskSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Hook = z.infer<typeof HookSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export type ParseError = { path: string; message: string };
export type ParseResult =
  | { ok: true; config: Config }
  | { ok: false; errors: ParseError[] };

export function parseConfig(input: unknown): ParseResult {
  const result = ConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, config: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
