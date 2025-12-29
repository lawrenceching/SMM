import { $ } from "bun";


await Promise.all([
  $`cd core && bun i`,
  $`cd ui && bun i`,
  $`cd cli && bun i`,
  $`cd electron && bun i`,
]);