import { $ } from "bun";


await Promise.all([
  $`cd apps/ui && bun dev`,
  $`cd apps/cli && bun dev | pino-pretty`,
]);