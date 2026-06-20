import type { ScrapeTaskAction, ScrapeTaskState } from "./types"

export function taskReducer(state: ScrapeTaskState, action: ScrapeTaskAction): ScrapeTaskState {
  switch (action.type) {
    case "INIT":
      return { tasks: action.tasks, isRunning: false }
    case "SET_COMPLETION":
      return {
        ...state,
        tasks: state.tasks.map((task) => ({
          ...task,
          status: action.completion[task.id] ? "completed" : "pending",
        })),
      }
    case "MARK_RUNNING":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: "running" } : task,
        ),
      }
    case "MARK_COMPLETED":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: "completed" } : task,
        ),
      }
    case "MARK_FAILED":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? { ...task, status: "failed", failedReason: action.reason }
            : task,
        ),
      }
    case "START_RUN":
      return { ...state, isRunning: true }
    case "FINISH_RUN":
      return { ...state, isRunning: false }
    default:
      return state
  }
}
