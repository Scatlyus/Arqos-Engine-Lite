export interface OrchestrationPlan {
  id: string;
  sequence: { tool_name: string; tool_input: Record<string, unknown> }[];
  timeout_budget: number;
}

export interface ExecutionResult {
  plan_id: string;
  success: boolean;
  outputs: unknown[];
  total_duration_ms: number;
  tools_executed: number;
  tools_failed: number;
  errors?: string[];
}

export interface ToolAvailability {
  total_tools: number;
  available_tools: number;
  degraded_tools: number;
  unavailable_tools: number;
  tools: {
    name: string;
    phase: string;
    status: "healthy" | "degraded" | "down";
    avg_latency_ms: number;
    success_rate: number;
  }[];
}
