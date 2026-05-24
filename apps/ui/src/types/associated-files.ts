export interface AssociatedFile {
  type: "subtitle" | "audio" | "thumbnail" | "summary"
  path: string
}

export interface RunningJob {
  type: "transcribing" | "translating" | "synthesising" | "processing"
}
