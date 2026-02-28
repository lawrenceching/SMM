export type PlanStatus = "idle" | "preparing" | "ready" | "rejected" | "executing" | "succeeded" | "failed"
export interface Plan {
    type: "RenameEpisode",
    status: PlanStatus,
    data?: any
}