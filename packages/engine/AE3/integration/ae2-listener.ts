import type { OrchestrationPlan } from "../types";

type PlanHandler = (plan: OrchestrationPlan) => Promise<void>;

export class AE2Listener {
  private handler?: PlanHandler;

  async connect(): Promise<void> {
    // Placeholder for AE2 connection.
  }

  onOrchestrationPlan(handler: PlanHandler): void {
    this.handler = handler;
  }

  async emitPlan(plan: OrchestrationPlan): Promise<void> {
    if (this.handler) {
      await this.handler(plan);
    }
  }
}
