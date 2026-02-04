export interface ExecutionPlan {
  id: string;
  sequence: unknown[];
  timeout_budget: number;
}

export interface ExecutionResult {
  plan_id: string;
  success: boolean;
  outputs: unknown[];
}
