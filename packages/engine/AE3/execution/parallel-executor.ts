import type { OrchestrationPlan, ExecutionResult } from "../types";
import type { ToolOutput } from "../integration/tool-interface";
import type { ToolRegistry } from "../tools/recebe/tool-registry";

type PlanStep = OrchestrationPlan["sequence"][number];

export class ParallelExecutor {
  constructor(private toolRegistry: ToolRegistry) {}

  async execute(graph: PlanStep[], _timeout: number): Promise<ExecutionResult> {
    const startTime = Date.now();

    const results = await Promise.all(
      graph.map(async (step) => {
        try {
          const tool = this.toolRegistry.createTool(step.tool_name);
          return await tool.execute(step.tool_input);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return {
            tool_id: step.tool_name,
            tool_name: step.tool_name,
            success: false,
            error: message,
            duration_ms: 0,
            timestamp: new Date()
          } as ToolOutput;
        }
      })
    );

    const toolsFailed = results.filter((out) => !out.success).length;

    return {
      plan_id: "",
      success: toolsFailed === 0,
      outputs: results,
      total_duration_ms: Date.now() - startTime,
      tools_executed: results.length,
      tools_failed: toolsFailed,
      errors: toolsFailed > 0 ? results.filter((o) => o.error).map((o) => o.error as string) : undefined
    };
  }
}
