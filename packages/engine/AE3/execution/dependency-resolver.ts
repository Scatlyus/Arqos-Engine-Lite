import type { OrchestrationPlan } from "../types";

type ToolJob = OrchestrationPlan["sequence"][number];

export class DependencyResolver {
  resolve(sequence: ToolJob[]): ToolJob[] {
    return sequence;
  }

  hasParallelOpportunities(_graph: ToolJob[]): boolean {
    return false;
  }
}
