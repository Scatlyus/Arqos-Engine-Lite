import type { OrchestrationPlan, ExecutionResult } from "../types";
import type { ToolOutput } from "../integration/tool-interface";
import type { ToolRegistry } from "../tools/recebe/tool-registry";

type PlanStep = OrchestrationPlan["sequence"][number];

export class SequentialExecutor {
  constructor(private toolRegistry: ToolRegistry) {}

  async execute(sequence: PlanStep[], _timeout: number): Promise<ExecutionResult> {
    const outputs: ToolOutput[] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    for (const step of sequence) {
      try {
        const tool = this.toolRegistry.createTool(step.tool_name);
        const result = await tool.execute(step.tool_input);
        outputs.push(result);
        if (!result.success && result.error) {
          errors.push(result.error);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(message);
        outputs.push({
          tool_id: step.tool_name,
          tool_name: step.tool_name,
          success: false,
          error: message,
          duration_ms: 0,
          timestamp: new Date()
        });
      }
    }

    const toolsFailed = outputs.filter((out) => !out.success).length;

    return {
      plan_id: "",
      success: toolsFailed === 0,
      outputs,
      total_duration_ms: Date.now() - startTime,
      tools_executed: outputs.length,
      tools_failed: toolsFailed,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
