import type { ScrapeTaskView } from "./types"

export function areAllTasksDone(tasks: ScrapeTaskView[]): boolean {
  return tasks.every((task) => task.status === "completed" || task.status === "failed")
}
