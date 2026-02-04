import { ToolRegistry } from "../tools/recebe/tool-registry";
import { SequentialExecutor } from "./sequential-executor";
import { ParallelExecutor } from "./parallel-executor";
import { DependencyResolver } from "./dependency-resolver";
import type { OrchestrationPlan, ExecutionResult } from "../types";

export class ExecutionEngine {
  private mode: "lite" | "fullstack";
  private sequentialExecutor: SequentialExecutor;
  private parallelExecutor?: ParallelExecutor;
  private dependencyResolver: DependencyResolver;

  constructor(mode: "lite" | "fullstack", toolRegistry: ToolRegistry) {
    this.mode = mode;
    this.sequentialExecutor = new SequentialExecutor(toolRegistry);
    if (mode === "fullstack") {
      this.parallelExecutor = new ParallelExecutor(toolRegistry);
    }
    this.dependencyResolver = new DependencyResolver();
  }

  async execute(plan: OrchestrationPlan): Promise<ExecutionResult> {
    console.log(`[AE3:ExecutionEngine] Executing plan: ${plan.id}`);

    const executionGraph = this.dependencyResolver.resolve(plan.sequence);
    const canParallelize =
      this.mode === "fullstack" &&
      this.dependencyResolver.hasParallelOpportunities(executionGraph);

    if (canParallelize) {
      console.log("[AE3:ExecutionEngine] Using parallel execution");
      const result = await this.parallelExecutor!.execute(executionGraph, plan.timeout_budget);
      return { ...result, plan_id: plan.id };
    }

    console.log("[AE3:ExecutionEngine] Using sequential execution");
    const result = await this.sequentialExecutor.execute(plan.sequence, plan.timeout_budget);
    return { ...result, plan_id: plan.id };
  }
}
