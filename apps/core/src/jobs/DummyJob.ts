import { AbstractJob, type JobOptions, type JobStatus } from "./types";

export class DummyJob extends AbstractJob {

  override abort(): Promise<void> {
      throw new Error("Method not implemented.");
  }
  override status(): Promise<JobStatus> {
      throw new Error("Method not implemented.");
  }

  constructor(options: JobOptions) {
    super(options);
  }

  async run(): Promise<void> {
    for(let i = 0; i < 10; i++) {
      await this.log(`waiting : ${i}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

}