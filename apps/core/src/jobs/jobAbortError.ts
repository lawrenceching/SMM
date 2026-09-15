export class JobAbortError extends Error {
  constructor(message = "aborted") {
    super(message);
    this.name = "JobAbortError";
  }
}
