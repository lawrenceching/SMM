import { $ } from "bun";


await Promise.all([
  $`cd ui && bun dev`,
  $`cd cli && bun dev | pino-pretty`,
]);