import type { AppContext, PlatformPorts } from "../types";
import { AbstractJob, type JobOptions } from "./abstract-job";

export class DummyJob extends AbstractJob {
  override abort(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  constructor(ctx: AppContext, ports: PlatformPorts, options: Omit<JobOptions, "type"> & { type?: string }) {
    super(ctx, ports, {
      ...options,
      type: options.type ?? "dummy",
    });
  }

  async run(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await this.log(`waiting : ${i}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
